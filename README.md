# embodied-first-exam.github.io

The website of the **Embodied First Exam**: the first exam for code agents in the physical world. It shows the exam's
questions, its leaderboard, the benchmark suites it is made of, how a question is marked, and how to contribute.

Published at <https://www.embodied-first-exam.ai/> by GitHub Pages, straight from `main` (the `CNAME` file holds the
custom domain; <https://embodied-first-exam.ai/> and <https://embodied-first-exam.github.io/> redirect there). There is
no build step: the pages are static HTML, one stylesheet and one script, and everything they show comes from two data
files. The pictures and videos are not in this repository (GitHub Pages serves at most 1 GB per site): they are in the
public HF dataset [MLL-Lab/embodied-exam-media](https://huggingface.co/datasets/MLL-Lab/embodied-exam-media) under
`site/<suite>/`, and the data names each by its address there with its content hash (`scripts/media.py`).

```
index.html, leaderboard/, suites/, suite/, tasks/, how/, contribute/   the pages
assets/exam.css, assets/app.js                                        the look and the drawing of every page
data/exam.json, data/tasks.json                                       suites, results, the label map; every question
scripts/                                                              export.py, media.py, upload_media.py, seo.py, stamp.py, check.py
sitemap.xml, robots.txt, llms.txt, llms-full.txt                      written by scripts/seo.py (make seo); do not edit by hand
CNAME                                                                 the custom domain, www.embodied-first-exam.ai
```

## Working on it

```bash
make serve                 # preview at http://127.0.0.1:8870/ (PORT=... to change)
make data SRC=<checkout>   # refresh data/ from the exam's source (its public mode); new or replaced media are made
                           #   into web copies in a local stage (MEDIA_DIR, default ~/.cache/efe-export/media)
make media                 # upload what make data listed as not on HF yet (needs an HF token with write access)
make release               # rewrite the search metadata (make seo), stamp the CSS and JS links, then check every link,
                           #   and every picture and video on HF
git push                   # GitHub Pages publishes main within a minute or two
```

`make check` also fails if any page or data file points at the internals of other sites (run logs, review pages,
private repositories): this site links only to its own pages and to public upstream projects.

## Task Atlas data

`data/atlas.json` (each question's summary, categories, keywords, objects, atomic steps, place on the task sphere and
related questions) and `data/search.json` (the index that `assets/search_core.js` searches) come from the EFE Task
Atlas package and cover exactly the questions in `data/tasks.json`. Rebuild both after every `make data`:

```bash
python3 scripts/export_atlas.py --atlas <Atlas package> --src ../tmp/2026-10-06_exam_site [--easy-set <easy_set.toml>]
```

- `--src` is the same source checkout as `make data`; its task inventory says which Atlas record each question is.
  Without it the record is found from the suite and the id.
- A question the Atlas has no record for is placed at the centre of its family (else its suite) on the sphere,
  marked `"est": 1`; rebuild the Atlas package to give it a summary and labels.
- `--easy-set` takes a newer easy-set list than the package's.
- The script writes only English, leaves out model results and task directory names, and refuses to write a file
  that contains Chinese text or anything `make check` forbids.

```js
import { makeSearch } from "/assets/search_core.js";
const S = makeSearch(await (await fetch("/data/search.json")).json());
const r = S.search("fold cloth");      // r.hits: indices into S.keys, best first; r.score[i] in 0..1
```
