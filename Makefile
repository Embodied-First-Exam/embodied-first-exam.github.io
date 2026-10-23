# The Embodied First Exam: a static site, served as it is by GitHub Pages from main. `make help` lists the targets.
PORT ?= 8870
SRC  ?= ../tmp/2026-10-06_exam_site
ATLAS ?= ../tmp/2026-10-17_atlas/src/efe-atlas-src-2026-10-17
EASY_SET ?=
PY   ?= python3
# the local stage of the site's media (scripts/media.py; default ~/.cache/efe-export/media), and the Python that has
# huggingface_hub for `make media` (e.g. HFPY="uv run --with huggingface_hub python")
MEDIA_DIR ?=
HFPY ?= $(PY)
export MEDIA_DIR

.DEFAULT_GOAL := help
.PHONY: help serve data media seo stamp check release

help: ## List the targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

serve: ## Preview the site at http://127.0.0.1:$(PORT)/
	@echo ""; echo "  OPEN THIS  ->  http://127.0.0.1:$(PORT)/"; echo ""
	$(PY) -m http.server $(PORT) --bind 127.0.0.1

data: ## Refresh data/ from the exam's source checkout (SRC=path), then the Atlas data (ATLAS=, EASY_SET=); new media into the stage
	$(PY) scripts/export.py --src $(SRC)
	@if [ -d "$(ATLAS)" ]; then $(PY) scripts/export_atlas.py --atlas $(ATLAS) --src $(SRC) $(if $(EASY_SET),--easy-set $(EASY_SET),); else echo "  (no ATLAS: data/atlas.json, data/search.json and the task sets left as they are)"; fi

media: ## Upload new or replaced media from the stage to HF (site/); DRY=1 only lists, PRUNE=1 also removes unused files
	$(HFPY) scripts/upload_media.py $(if $(DRY),--dry-run,) $(if $(PRUNE),--prune,)

seo: ## Rewrite what search engines read but visitors do not see (JSON-LD, keywords, sitemap, robots.txt, llms*.txt) from data/
	$(PY) scripts/seo.py

stamp: ## Give the pages' CSS and JS links a content hash
	$(PY) scripts/stamp.py

check: ## Check every link, that every picture and video is on HF, and that nothing points at other sites' internals
	$(PY) scripts/check.py

release: seo stamp check ## What to run before a commit: seo, stamp, then check
