Computer Networks — Chapter 4 Group Project: ARP & Network Routing Lab
======================================================================

Overview
--------
This repository contains the shared simulation core, interactive topology UI, and source material for the Chapter 4 Computer Networks group assignment ("ARP và định tuyến mạng"). We are upgrading a single-file ARP/routing packet journey visualizer into a multi-scenario interactive network troubleshooting lab that runs completely offline over `file://`.

Repository Structure
--------------------
- `app/`
  - `index.html` — Main entry point (works offline via `file://` in any modern browser; no web server or build step required).
  - `HUONG_DAN_CHAY.txt` — Detailed instructions for running the app, using the UI, and running tests.
  - `js/core/` — Simulation engine (`net.js`, `model.js`, `bus.js`, `registry.js`, `store.js`, `engine.js`). Implements IPv4/CIDR math, Longest Prefix Match (LPM), ARP cache resolution, hop-by-hop L2 MAC rewrite & TTL decrement, event bus, and plugin registry.
  - `js/modules/topology/topology_editor.js` — Interactive topology editor (7 preset topologies, SVG drag-and-drop, device/link editing, link cost & up/down controls, frame inspector).
  - `js/modules/_stubs/stubs.js` — Stub panels for the Lab view (`panel_packet_inspector`, `panel_event_timeline`, `panel_baseline_compare`, `panel_troubleshooting`, `panel_topology_editor`). Replace your assigned stub panel using `NetLab.registry.registerPanel(id, impl)`.
  - `scenarios/` — Reference scenario (`ref_hai_router.js`) and skeleton scenarios (`_skeleton_A.js`, `_skeleton_B.js`, `_skeleton_C.js`, `_skeleton_D.js`, `_skeleton_X.js`) ready to be filled in.
  - `schema/scenario.schema.json` — JSON Schema for scenarios.
  - `tests/` — Automated unit tests (`*.test.js`), scenario schema validator (`validate_scenarios.js`), test runner (`run_all.js`), and Playwright browser checks (`smoke_test.py`, `legacy_check.py`).
- `docs/`
  - `Chapter 4 - TASK.pdf` — Original assignment prompt and requirements.
  - `Phan_cong_nhom_Chuong4.docx` — Group task division and module ownership.
  - `base_simulator.html` & `Mô phỏng ARP và định tuyến - Hành trình của một gói tin.html` — Original starter HTML simulator.
  - `noi_bo/huong_dan_tich_hop.txt` (and `.docx`) — Developer integration guide explaining how to register custom scenarios (`NetLab.registry.registerScenario`), UI panels (`NetLab.registry.registerPanel`), and topologies (`NetLab.registry.registerTopology`).

Quick Start
-----------
1. Run the simulator in a browser:
   Open `app/index.html` directly in Chrome, Edge, or Firefox (double-click or `file://`).
   - "Hành trình cơ bản" tab: Original 7-step remote / 5-step local ARP & routing walkthrough plus the interactive Topology Lab editor below it.
   - "Phòng thí nghiệm" tab: Multi-scenario simulation engine with step-by-step packet playback, ARP cache & routing tables, and pluggable inspection panels.

2. Run unit tests & scenario validation (requires Node.js):
   ```
   cd app
   node --test tests/*.test.js
   node tests/validate_scenarios.js
   node tests/run_all.js
   ```

3. Run browser smoke tests (optional, requires Python + Playwright):
   ```
   cd app
   python tests/smoke_test.py
   python tests/legacy_check.py
   ```

How to Integrate Your Module / Scenario
---------------------------------------
See `docs/noi_bo/huong_dan_tich_hop.txt` and `app/HUONG_DAN_CHAY.txt` for full API details:
- Offline `file://` rule: Do not use ES module `import`/`export` or `fetch()` for local files (browsers block them on `file://`). Wrap scripts in a standard IIFE and register components on `window.NetLab.registry`.
- Scenarios: Edit your assigned file in `app/scenarios/_skeleton_*.js` (or add a new script tag in `app/index.html`) and validate with `node tests/validate_scenarios.js`.
- UI Panels: Register your panel via `NetLab.registry.registerPanel(panelId, { title, mount, onStep, onEvent, onReset })` after `stubs.js` so it overrides the default placeholder.
