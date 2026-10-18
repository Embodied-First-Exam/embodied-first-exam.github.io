# The Embodied First Exam: a static site, served as it is by GitHub Pages from main. `make help` lists the targets.
PORT ?= 8870
SRC  ?= ../tmp/2026-10-06_exam_site
ATLAS ?= ../tmp/2026-10-17_atlas/src/efe-atlas-src-2026-10-17
EASY_SET ?=
PY   ?= python3

.DEFAULT_GOAL := help
.PHONY: help serve data stamp check release

help: ## List the targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

serve: ## Preview the site at http://127.0.0.1:$(PORT)/
	@echo ""; echo "  OPEN THIS  ->  http://127.0.0.1:$(PORT)/"; echo ""
	$(PY) -m http.server $(PORT) --bind 127.0.0.1

data: ## Refresh data/ and media/ from the exam's source checkout (SRC=path), then the Atlas data (ATLAS=, EASY_SET=)
	$(PY) scripts/export.py --src $(SRC)
	@if [ -d "$(ATLAS)" ]; then $(PY) scripts/export_atlas.py --atlas $(ATLAS) --src $(SRC) $(if $(EASY_SET),--easy-set $(EASY_SET),); else echo "  (no ATLAS: data/atlas.json, data/search.json and the task sets left as they are)"; fi

stamp: ## Give the pages' CSS and JS links a content hash
	$(PY) scripts/stamp.py

check: ## Check every link, picture and video, and that nothing points at other sites' internals
	$(PY) scripts/check.py

release: stamp check ## What to run before a commit: stamp, then check
