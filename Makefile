# The Embodied First Exam: a static site, served as it is by GitHub Pages from main. `make help` lists the targets.
PORT ?= 8870
SRC  ?= ../tmp/2026-10-06_exam_site
PY   ?= python3

.DEFAULT_GOAL := help
.PHONY: help serve data stamp check release

help: ## List the targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

serve: ## Preview the site at http://127.0.0.1:$(PORT)/
	@echo ""; echo "  OPEN THIS  ->  http://127.0.0.1:$(PORT)/"; echo ""
	$(PY) -m http.server $(PORT) --bind 127.0.0.1

data: ## Refresh data/ and media/ from the exam's source checkout (SRC=path)
	$(PY) scripts/export.py --src $(SRC)

stamp: ## Give the pages' CSS and JS links a content hash
	$(PY) scripts/stamp.py

check: ## Check every link, picture and video, and that nothing points at other sites' internals
	$(PY) scripts/check.py

release: stamp check ## What to run before a commit: stamp, then check
