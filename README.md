# Chapter 4 — ARP & Network Routing Lab

Offline browser-based network simulation lab for Chapter 4 Computer Networks (`ARP và định tuyến mạng`). Upgrades the base packet visualizer into an interactive multi-scenario simulator with topology editing, IPv4/LPM routing, ARP cache tracking, and pluggable inspection panels.

## Repository Structure

```text
.
├── app/                  # Web application (runs offline via file://, no server needed)
│   ├── css/              # App layout and legacy simulation styles
│   ├── js/
│   │   ├── core/         # Simulation engine, packet model, LPM routing, ARP cache & bus
│   │   ├── legacy/       # Base step-by-step ARP and routing walkthrough
│   │   ├── modules/      # Pluggable lab panels and interactive topology editor
│   │   └── ui/           # Navigation shell and tab view switcher
│   ├── scenarios/        # Reference scenarios and skeleton templates for member tasks
│   ├── schema/           # JSON schema for scenario validation
│   └── tests/            # Unit tests, validator scripts, and browser checks
└── docs/                 # Assignment prompt, task division, and member integration guides
```

## Quick Start

Open `app/index.html` directly in any modern web browser.

```bash
cd app
node --test tests/*.test.js
node tests/validate_scenarios.js
node tests/run_all.js
```

## Module Integration

See `docs/noi_bo/huong_dan_tich_hop.txt` and `app/HUONG_DAN_CHAY.txt` for integration APIs (`NetLab.registry.registerScenario`, `registerPanel`, `registerTopology`). All modules must use plain IIFEs to support `file://` execution without CORS restrictions.
