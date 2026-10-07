# embodied-first-exam.github.io

The website of the **Embodied First Exam**: the first exam for code agents in the physical world. It shows the exam's
questions, its leaderboard, the benchmark suites it is made of, how a question is marked, and how to contribute.

Published at <https://embodied-first-exam.github.io/> by GitHub Pages, straight from `main`. There is no build step:
the pages are static HTML, one stylesheet and one script, and everything they show comes from two data files.

```
index.html, leaderboard/, suites/, suite/, tasks/, how/, contribute/   the pages
assets/exam.css, assets/app.js                                        the look and the drawing of every page
data/exam.json, data/tasks.json                                       suites, results, the label map; every question
media/<suite>/                                                        pictures and demo videos
scripts/                                                              export.py, stamp.py, check.py
```

## Working on it

```bash
make serve                 # preview at http://127.0.0.1:8870/ (PORT=... to change)
make data SRC=<checkout>   # refresh data/ and media/ from the exam's source (its public mode)
make release               # stamp the CSS and JS links, then check every link, picture and video
git push                   # GitHub Pages publishes main within a minute or two
```

`make check` also fails if any page or data file points at the internals of other sites (run logs, review pages,
private repositories): this site links only to its own pages and to public upstream projects.
