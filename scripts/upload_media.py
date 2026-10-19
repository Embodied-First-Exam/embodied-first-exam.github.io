#!/usr/bin/env python3
"""Upload the site's new or replaced pictures and videos to HF (`make media`).

Every media file the pages use (the data's HF addresses, and the home page's own examples named in assets/app.js) must
be in the public dataset's site/ folder with the content hash its address names. This uploads, from the local stage
(scripts/media.py STAGE, filled by `make data`), each one that HF lacks or has in another version, in a few commits,
then lists the dataset again and checks every file. Nothing is deleted unless --prune is given; then the files under
site/ that nothing refers to are listed and removed (in the dataset's history they stay).

    python3 scripts/upload_media.py [--dry-run] [--prune]

Needs huggingface_hub and a token with write access to the dataset (HF_TOKEN, or `hf auth login`).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import media  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CHUNK = 250          # files per commit


def plan() -> tuple[dict[str, str], dict[str, tuple[int, str]], list[str], list[str]]:
    refs, hf = media.referenced(ROOT), media.listing()
    upload, problems = [], []
    for rel, v in sorted(refs.items()):
        on_hf = hf.get(rel, (0, ""))[1]
        if on_hf and (not v or on_hf.startswith(v)):
            continue
        f = media.STAGE / rel
        if not f.is_file():
            problems.append(f"{rel}: not on HF{' in version ' + v if on_hf else ''} and not in the stage {media.STAGE}")
        elif v and not media.sha256(f).startswith(v):
            problems.append(f"{rel}: the staged file is not version {v}; run `make data` again")
        else:
            upload.append(rel)
    return refs, hf, upload, problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="only list what would be uploaded (and removed)")
    ap.add_argument("--prune", action="store_true", help="also remove the files under site/ that nothing refers to")
    args = ap.parse_args()
    refs, hf, upload, problems = plan()
    for p in problems:
        print("  ERROR", p, file=sys.stderr)
    if problems:
        return 1
    unused = sorted(set(hf) - set(refs))
    size = sum((media.STAGE / r).stat().st_size for r in upload)
    print(f"{len(refs)} media files referenced; {len(upload)} to upload ({size / 1e6:.1f} MB); "
          f"{len(unused)} on HF that nothing refers to{' (to remove)' if args.prune else ' (kept)'}")
    for r in upload[:50]:
        print("  +", r)
    if len(upload) > 50:
        print("  ...")
    if args.prune:
        for r in unused:
            print("  -", r)
    if args.dry_run or not (upload or (args.prune and unused)):
        return 0

    from huggingface_hub import CommitOperationAdd, CommitOperationDelete, HfApi
    api = HfApi()
    for i in range(0, len(upload), CHUNK):
        part = upload[i:i + CHUNK]
        ops = [CommitOperationAdd(path_in_repo=f"{media.PREFIX}/{r}", path_or_fileobj=str(media.STAGE / r)) for r in part]
        c = api.create_commit(media.REPO, repo_type="dataset", operations=ops,
                              commit_message=f"site media: {len(part)} files ({part[0].split('/')[0]} ... {part[-1].split('/')[0]})")
        print(f"  uploaded {i + len(part)}/{len(upload)}: {c.commit_url}")
    if args.prune and unused:
        for i in range(0, len(unused), CHUNK):
            part = unused[i:i + CHUNK]
            c = api.create_commit(media.REPO, repo_type="dataset", commit_message=f"site media: remove {len(part)} unused files",
                                  operations=[CommitOperationDelete(path_in_repo=f"{media.PREFIX}/{r}") for r in part])
            print(f"  removed {i + len(part)}/{len(unused)}: {c.commit_url}")
    _, _, left, problems = plan()
    if left or problems:
        print(f"  ERROR after the upload: {len(left)} still to upload, {len(problems)} problems", file=sys.stderr)
        return 1
    print(f"all {len(refs)} media files are on HF in the versions the site names")
    return 0


if __name__ == "__main__":
    sys.exit(main())
