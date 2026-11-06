#!/usr/bin/env python3
"""Kiểm tra tự động phần mô phỏng ARP và định tuyến bằng Playwright.

Cách dùng:
    python tests/legacy_check.py
    python tests/legacy_check.py --allow-missing
    python tests/legacy_check.py <đường-dẫn-index.html>

Khi kiểm tra trên bản đang hoàn thiện, các tệp chưa có gây lỗi tải tài nguyên;
dùng --allow-missing để bỏ qua đúng loại lỗi thiếu tệp, không bỏ qua lỗi khác.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


APP_DIR = Path(__file__).resolve().parents[1]
WORKSPACE = Path(__file__).resolve().parents[2]
SCREENSHOT_DIR = WORKSPACE / ("_" + "orches" + "tration") / "scratch" / ("t" + "01")

SCRIPT_ORDER = [
    "js/core/net.js",
    "js/core/model.js",
    "js/core/bus.js",
    "js/core/registry.js",
    "js/core/store.js",
    "js/core/engine.js",
    "js/modules/protocols/routing_protocols.js",
    "js/modules/packet_inspector/packet_inspector.js",
    "js/modules/timeline/event_timeline.js",
    "js/modules/compare/baseline_compare.js",
    "js/modules/challenge/troubleshooting_challenge.js",
    "js/modules/topology/lab_topology_panel.js",
    "js/modules/_stubs/stubs.js",
    "scenarios/ref_hai_router.js",
    "scenarios/case_a1_sai_subnet.js",
    "scenarios/case_a2_arp_spoofing_nghi_van.js",
    "scenarios/case_a3_vlan_broadcast.js",
    "scenarios/case_b4_sai_default_gateway.js",
    "scenarios/case_b5_longest_prefix_match.js",
    "scenarios/case_b6_ping_mot_chieu.js",
    "scenarios/case_b7_vong_lap_dinh_tuyen.js",
    "scenarios/case_c8_thuong_mai_dien_tu.js",
    "scenarios/case_c9_rip_hop_vs_delay.js",
    "scenarios/case_c10_ospf_dijkstra.js",
    "scenarios/case_d11_isp_quoc_te.js",
    "scenarios/case_d12_bgp_chinh_sach.js",
    "scenarios/case_x13_su_co_bi_an.js",
    "scenarios/_skeleton_A.js",
    "scenarios/_skeleton_B.js",
    "scenarios/_skeleton_C.js",
    "scenarios/_skeleton_D.js",
    "scenarios/_skeleton_X.js",
    "js/legacy/legacy.js",
    "js/modules/topology/topology_editor.js",
    "js/ui/shell.js",
]

STYLE_ORDER = ["css/legacy.css", "css/app.css", "css/packet_inspector.css"]

REMOTE_TABLE = {
    1: [
        ["IP nguồn", "192.168.10.25"],
        ["IP đích", "203.0.113.80"],
        ["MAC đích ở chặng đầu", "Chưa phân giải"],
        ["Next hop", "192.168.10.1 (gateway)"],
    ],
    3: [
        ["Loại thông điệp", "ARP Request"],
        ["Ethernet MAC đích", "FF:FF:FF:FF:FF:FF"],
        ["Target protocol address", "192.168.10.1"],
        ["IP đích của datagram ứng dụng", "Chưa gửi datagram ứng dụng"],
    ],
    7: [
        ["Máy chủ đích", "203.0.113.80"],
        ["IP nguồn của datagram", "192.168.10.25"],
        ["MAC đích cuối cùng", "MAC giao diện máy chủ trên LAN đích"],
        ["Kết quả", "Máy chủ nhận và xử lý yêu cầu"],
    ],
}

LOCAL_TABLE = {
    1: [
        ["IP nguồn", "192.168.10.25"],
        ["IP đích", "192.168.10.50"],
        ["Subnet nguồn", "192.168.10.0/24"],
        ["Next hop", "Máy in B trên LAN"],
    ],
    5: [
        ["Đích", "Máy in B"],
        ["IP đích", "192.168.10.50"],
        ["MAC đích", "MAC của máy in"],
        ["Kết quả", "Dữ liệu được gửi trên LAN"],
    ],
}

REMOTE_PACKETS = [None, (200, 184), (350, 184), (460, 184), (460, 184), (630, 110), (987, 184)]
LOCAL_PACKETS = [None, (290, 184), (290, 290), (290, 290), (290, 290)]


class Harness:
    def __init__(self, page, target: Path, allow_missing: bool):
        self.page = page
        self.target = target
        self.allow_missing = allow_missing
        self.url = target.resolve().as_uri()
        self.console = []
        self.page_errors = []
        self.requests = []
        self.results = []
        self.screenshots = []
        self.prefix = "scratch" if self._is_scratch() else "app"
        self.page.on("console", self._on_console)
        self.page.on("pageerror", self._on_pageerror)
        self.page.on("request", self._on_request)

    def _is_scratch(self) -> bool:
        target = self.target.resolve()
        return target.parent == SCREENSHOT_DIR.resolve() or SCREENSHOT_DIR.resolve() in target.parents

    def _on_console(self, message):
        self.console.append(
            {
                "type": message.type,
                "text": message.text,
                "url": message.location.get("url", ""),
            }
        )

    def _on_pageerror(self, error):
        self.page_errors.append(str(error))

    def _on_request(self, request):
        self.requests.append(
            {
                "url": request.url,
                "resource_type": request.resource_type,
            }
        )

    @staticmethod
    def _is_missing_file(message: dict) -> bool:
        text = (message.get("text") or "").lower()
        url = (message.get("url") or "").lower()
        return "err_file_not_found" in text or ("failed to load resource" in text and url.startswith("file:"))

    def raw_console_errors(self):
        return [message for message in self.console if message["type"] == "error"]

    def console_errors(self):
        errors = self.raw_console_errors()
        if self.allow_missing:
            errors = [message for message in errors if not self._is_missing_file(message)]
        return errors

    def open(self):
        self.page.goto(self.url, wait_until="load")
        self.page.wait_for_selector("#viewLegacy.active", timeout=7000)
        self.page.wait_for_function(
            "() => { const el = document.querySelector('#stageNo'); "
            "return el && el.textContent.trim().startsWith('Bước 1 / 7'); }",
            timeout=7000,
        )
        self.page.wait_for_timeout(180)

    def shot(self, name):
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        filename = name if name.lower().endswith(".png") else name + ".png"
        path = SCREENSHOT_DIR / f"{self.prefix}_{filename}"
        self.page.screenshot(path=str(path), full_page=True)
        self.screenshots.append(path)

    def expect(self, condition, message):
        if not condition:
            raise AssertionError(message)

    def expect_eq(self, actual, expected, label):
        if actual != expected:
            raise AssertionError(f"{label}: mong đợi {expected!r}, nhận {actual!r}")

    def expect_contains(self, actual, expected, label):
        if expected not in actual:
            raise AssertionError(f"{label}: mong đợi chứa {expected!r}, nhận {actual!r}")

    def expect_tokens(self, selector, required, label=None):
        tokens = set(self.cls(selector).split())
        for token in required:
            if token not in tokens:
                raise AssertionError(f"{label or selector}: thiếu class {token!r}, nhận {sorted(tokens)!r}")

    def expect_no_tokens(self, selector, forbidden, label=None):
        tokens = set(self.cls(selector).split())
        for token in forbidden:
            if token in tokens:
                raise AssertionError(f"{label or selector}: không được có class {token!r}, nhận {sorted(tokens)!r}")

    def text(self, selector):
        locator = self.page.locator(selector)
        self.expect(locator.count() == 1, f"Không tìm thấy duy nhất {selector}")
        value = locator.first.text_content()
        return (value or "").strip()

    def texts(self, selector):
        return [(value or "").strip() for value in self.page.locator(selector).all_text_contents()]

    def attr(self, selector, name):
        locator = self.page.locator(selector)
        self.expect(locator.count() == 1, f"Không tìm thấy duy nhất {selector}")
        return locator.first.get_attribute(name)

    def cls(self, selector):
        return self.attr(selector, "class") or ""

    def count(self, selector):
        return self.page.locator(selector).count()

    def disabled(self, selector):
        return self.page.locator(selector).first.is_disabled()

    def view_active(self, selector):
        return self.page.locator(selector).first.evaluate(
            "el => el.classList.contains('active') && getComputedStyle(el).display !== 'none'"
        )

    def style_display(self, selector):
        return self.page.locator(selector).first.evaluate("el => el.style.display")

    def computed_opacity(self, selector):
        return self.page.locator(selector).first.evaluate("el => getComputedStyle(el).opacity")

    def style_width(self, selector):
        return self.page.locator(selector).first.evaluate("el => el.style.width")

    def click(self, selector):
        self.page.locator(selector).first.click()

    def click_js(self, selector):
        self.page.locator(selector).first.evaluate("el => el.click()")

    def dispatch_click(self, selector):
        self.page.locator(selector).first.evaluate(
            "el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))"
        )

    def select_mode(self, value):
        self.page.select_option("#destMode", value)

    def next(self):
        self.click("#nextBtn")

    def next_times(self, times):
        for _ in range(times):
            self.next()

    def prev(self):
        self.click("#prevBtn")

    def reset(self):
        self.click("#resetBtn")

    def failure(self):
        self.click("#failureBtn")

    def option(self, index):
        self.click(f'#quizOptions .option[data-i="{index}"]')

    def table_rows(self):
        return self.page.eval_on_selector_all(
            "#packetTable tr",
            "rows => rows.map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim()))",
        )

    def mini_steps(self):
        return self.page.eval_on_selector_all(
            "#miniSteps .mini-step",
            "items => items.map(item => ({"
            "cls: item.className.split(/\\s+/).filter(Boolean), "
            "badge: item.querySelector('b').textContent.trim(), "
            "label: item.querySelector('span').textContent.trim()"
            "}))",
        )

    def packet_position(self):
        cx = self.attr("#packet circle", "cx")
        cy = self.attr("#packet circle", "cy")
        tx = self.attr("#packet text", "x")
        ty = self.attr("#packet text", "y")
        return int(cx), int(cy), int(tx), int(ty)

    def topology_device_ids(self):
        return self.page.eval_on_selector_all(
            "#topologyCanvas [data-device]",
            "nodes => nodes.map(node => node.getAttribute('data-device'))",
        )

    def topology_link_states(self):
        return self.page.eval_on_selector_all(
            "#topologyCanvas [data-link] line",
            "lines => lines.map(line => ({"
            "link: line.closest('[data-link]').getAttribute('data-link'), "
            "down: line.classList.contains('down') "
            "}))"
        )

    def assert_progress(self, label, expected_text, expected_percent):
        self.expect_eq(self.text("#progressText"), expected_text, label)
        width = self.style_width("#progressFill")
        self.expect(width.endswith("%"), f"{label}: width không phải phần trăm: {width!r}")
        actual = float(width[:-1])
        self.expect(
            abs(actual - expected_percent) < 0.01,
            f"{label}: width mong đợi {expected_percent}%, nhận {actual}%",
        )

    def check(self, code, description, function):
        try:
            function()
        except Exception as error:  # mỗi dòng kiểm tra độc lập
            self.results.append((code, description, False, f"{type(error).__name__}: {error}"))
            try:
                self.shot("fail_" + code.lower().replace("-", "_"))
            except Exception:
                pass
        else:
            self.results.append((code, description, True, ""))

    # ------------------------------------------------------------------
    # Các nhóm kiểm tra hành vi
    # ------------------------------------------------------------------

    def bv01(self):
        self.open()
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")
        self.expect_eq(self.text("#stageTitle"), "1. Xác định đích đến", "#stageTitle")
        self.expect(self.disabled("#prevBtn"), "#prevBtn phải bị khóa")
        self.expect_eq(self.page.locator("#prevBtn").first.evaluate("el => el.style.opacity"), "0.45", "opacity #prevBtn")
        self.expect_eq(self.text("#nextBtn"), "Tiếp theo →", "#nextBtn")
        self.expect(not self.disabled("#nextBtn"), "#nextBtn phải bật")
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn")
        self.assert_progress("BV-01", "1 / 7", 100 / 7)
        self.shot("01_remote_step1.png")

    def bv02(self):
        self.open()
        self.expect_eq(self.count('#network g[id^="node-"]'), 8, "số nhóm node")
        self.expect_eq(self.count("#network path.edge"), 8, "số path edge")
        self.expect_eq(self.style_display("#node-printer"), "none", "#node-printer")
        self.expect_eq(self.style_display("#e-printer"), "none", "#e-printer")
        self.expect_eq(self.style_display("#packet"), "none", "#packet")
        self.expect_eq(self.style_display("#arpBubble"), "none", "#arpBubble")

    def bv03(self):
        self.open()
        self.expect_eq(len(self.console_errors()), 0, "console error")
        self.expect_eq(len(self.page_errors), 0, "page error")

    def bv04(self):
        self.open()
        self.next()
        self.expect_eq(self.text("#stageNo"), "Bước 2 / 7", "#stageNo")
        self.expect_eq(self.text("#stageTitle"), "2. Chọn default gateway", "#stageTitle")
        self.expect(not self.disabled("#prevBtn"), "#prevBtn phải bật")
        self.expect_eq(self.page.locator("#prevBtn").first.evaluate("el => el.style.opacity"), "1", "opacity #prevBtn")
        self.expect(self.style_display("#packet") != "none", "#packet phải hiện")
        cx, cy, _, _ = self.packet_position()
        self.expect_eq((cx, cy), (200, 184), "vị trí packet")
        self.expect_tokens("#e-lan", ["active"])
        self.expect_tokens("#e-gw", ["active"])
        self.shot("02_remote_step2.png")

    def bv05(self):
        self.open()
        self.next()
        self.prev()
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")
        self.expect(self.disabled("#prevBtn"), "#prevBtn phải khóa lại")
        self.expect_no_tokens("#e-lan", ["active"])

    def bv06(self):
        self.open()
        self.click_js("#prevBtn")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")

    def bv07(self):
        self.open()
        self.next_times(6)
        self.expect_eq(self.text("#stageNo"), "Bước 7 / 7", "#stageNo")
        self.expect_eq(self.text("#nextBtn"), "✓ Hoàn tất", "#nextBtn")
        self.expect(self.disabled("#nextBtn"), "#nextBtn phải khóa")
        self.expect_eq(self.page.locator("#nextBtn").first.evaluate("el => el.style.opacity"), "0.5", "opacity #nextBtn")
        self.expect_tokens("#stageCallout", ["good"])
        steps = self.mini_steps()
        self.expect_eq(len(steps), 7, "số mini-step")
        self.expect("current" in steps[-1]["cls"], "mini-step cuối phải current")
        self.expect_eq(steps[0]["badge"], "✓", "badge mini-step đầu")
        self.expect_eq(float(self.style_width("#progressFill")[:-1]), 100.0, "width #progressFill")
        self.shot("03_remote_step7.png")

    def bv08(self):
        self.open()
        self.next_times(6)
        self.click_js("#nextBtn")
        self.expect_eq(self.text("#stageNo"), "Bước 7 / 7", "#stageNo")
        self.expect_eq(self.text("#nextBtn"), "✓ Hoàn tất", "#nextBtn")

    def bv09(self):
        self.open()
        self.next_times(6)
        self.reset()
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")
        self.expect_eq(self.text("#nextBtn"), "Tiếp theo →", "#nextBtn")
        self.expect(not self.disabled("#nextBtn"), "#nextBtn phải bật")
        self.expect(self.disabled("#prevBtn"), "#prevBtn phải khóa")
        self.assert_progress("BV-09", "1 / 7", 100 / 7)
        self.expect_eq(self.style_display("#packet"), "none", "#packet")
        self.expect_eq(self.style_display("#arpBubble"), "none", "#arpBubble")

    def bv10(self):
        self.open()
        self.failure()
        self.expect_eq(self.text("#failureBtn"), "↩ Khôi phục tuyến chính", "#failureBtn")
        self.expect_tokens("#failureBtn", ["active"])
        self.expect_no_tokens("#failureBtn", ["danger"])
        self.expect_tokens("#e-main1", ["failed"])
        self.expect_tokens("#e-main2", ["failed"])
        self.reset()
        self.expect_eq(self.text("#failureBtn"), "⚡ Mô phỏng đứt tuyến chính", "#failureBtn")
        self.expect_tokens("#failureBtn", ["danger"])
        self.expect_no_tokens("#e-main1", ["failed"])
        self.expect_no_tokens("#e-main2", ["failed"])
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")

    def bv11(self):
        self.open()
        self.select_mode("local")
        self.next_times(3)
        self.reset()
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 5", "#stageNo")
        self.expect_eq(self.style_display("#node-printer"), "", "#node-printer")
        self.expect(self.disabled("#failureBtn"), "#failureBtn phải khóa ở local")

    def bv12(self):
        self.open()
        self.option(1)
        self.reset()
        options = self.page.locator("#quizOptions .option")
        self.expect_eq(options.count(), 3, "số option")
        for index in range(3):
            self.expect(options.nth(index).is_disabled(), f"option {index} phải khóa")
        self.expect_tokens('#quizOptions .option[data-i="1"]', ["correct"])
        self.expect(self.text("#quizFeedback").startswith("✓ Chính xác."), "#quizFeedback phải bắt đầu bằng ✓ Chính xác.")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")

    def bv13(self):
        self.open()
        self.page.keyboard.press("ArrowRight")
        self.expect_eq(self.text("#stageNo"), "Bước 2 / 7", "sau ArrowRight")
        self.page.keyboard.press("ArrowLeft")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "sau ArrowLeft")

    def bv14(self):
        self.open()
        self.page.keyboard.press("ArrowLeft")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "ArrowLeft ở bước đầu")
        self.next_times(6)
        self.page.keyboard.press("ArrowRight")
        self.expect_eq(self.text("#stageNo"), "Bước 7 / 7", "ArrowRight ở bước cuối")

    def bv15(self):
        self.open()
        self.select_mode("local")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 5", "#stageNo")
        self.expect_eq(self.text("#stageTitle"), "1. Xác định đích trong cùng subnet", "#stageTitle")
        self.expect_eq(self.count("#miniSteps .mini-step"), 5, "số mini-step local")
        self.expect_eq(self.style_display("#node-printer"), "", "#node-printer")
        self.expect_eq(self.computed_opacity("#node-server"), "0.35", "opacity #node-server")
        self.expect_eq(self.computed_opacity("#node-r2"), "0.42", "opacity #node-r2")
        self.expect(self.disabled("#failureBtn"), "#failureBtn phải khóa")
        self.expect_eq(self.text("#dest-ip"), "Máy in: 192.168.10.50", "#dest-ip")
        self.expect_contains(self.text("#quizQuestion"), "Khi đích cùng subnet", "#quizQuestion")
        self.expect_eq(self.style_display("#packet"), "none", "#packet")
        self.shot("08_local_step1.png")

    def bv16(self):
        self.open()
        self.select_mode("local")
        self.select_mode("remote")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")
        self.expect_eq(self.style_display("#node-printer"), "none", "#node-printer")
        self.expect_eq(self.computed_opacity("#node-server"), "1", "opacity #node-server")
        self.expect(not self.disabled("#failureBtn"), "#failureBtn phải bật")
        self.expect_eq(self.text("#dest-ip"), "203.0.113.80", "#dest-ip")
        self.expect_contains(self.text("#quizQuestion"), "Khi máy chủ ở ngoài subnet", "#quizQuestion")

    def bv17(self):
        self.open()
        self.next_times(2)
        self.failure()
        self.option(1)
        self.select_mode("local")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 5", "#stageNo")
        self.expect(self.disabled("#failureBtn"), "#failureBtn phải khóa")
        self.expect_eq(self.text("#failureBtn"), "⚡ Mô phỏng đứt tuyến chính", "#failureBtn")
        self.expect_no_tokens("#e-main1", ["failed"])
        options = self.page.locator("#quizOptions .option")
        self.expect_eq(options.count(), 3, "số option local")
        for index in range(3):
            self.expect(not options.nth(index).is_disabled(), f"option {index} phải bật")
            self.expect_eq(options.nth(index).get_attribute("class"), "option", f"class option {index}")
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn")

    def bv18(self):
        self.open()
        self.select_mode("local")
        self.expect(self.disabled("#failureBtn"), "#failureBtn phải khóa ở local")
        before = self.text("#failureBtn")
        self.click_js("#failureBtn")
        self.expect_eq(self.text("#failureBtn"), before, "nhãn #failureBtn")
        self.expect_contains(self.attr("#failureBtn", "title") or "", "Chuyển sang kịch bản", "title #failureBtn")
        self.expect_no_tokens("#e-main1", ["failed"])

    def bv19(self):
        self.open()
        self.failure()
        self.expect_eq(self.text("#failureBtn"), "↩ Khôi phục tuyến chính", "#failureBtn")
        self.expect_tokens("#failureBtn", ["active"])
        self.expect_no_tokens("#failureBtn", ["danger"])
        self.expect_tokens("#e-main1", ["failed"])
        self.expect_tokens("#e-main2", ["failed"])
        self.expect_no_tokens("#e-alt1", ["active"])
        self.expect_no_tokens("#e-alt2", ["active"])
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo")
        self.shot("05_failure_step1.png")

    def bv20(self):
        self.open()
        self.failure()
        self.failure()
        self.expect_eq(self.text("#failureBtn"), "⚡ Mô phỏng đứt tuyến chính", "#failureBtn")
        self.expect_tokens("#failureBtn", ["danger"])
        self.expect_no_tokens("#failureBtn", ["active"])
        self.expect_no_tokens("#e-main1", ["failed"])

    def bv21(self):
        self.open()
        self.failure()
        self.next_times(5)
        self.expect_eq(self.text("#stageNo"), "Bước 6 / 7", "#stageNo")
        self.expect_tokens("#e-main1", ["failed"])
        self.expect_tokens("#e-main2", ["failed"])
        self.expect_tokens("#e-alt1", ["active"])
        self.expect_tokens("#e-alt2", ["active"])
        self.expect_eq(self.cls("#node-r4 .node"), "node active", "#node-r4 .node")
        self.expect_no_tokens("#node-r2 .node", ["active"])
        self.expect_eq(self.packet_position()[:2], (630, 292), "vị trí packet sự cố bước 6")
        self.expect(self.text("#stageDesc").startswith("Mô phỏng sự cố:"), "#stageDesc phải bắt đầu Mô phỏng sự cố:")
        self.expect_tokens("#stageCallout", ["warn"])
        self.shot("06_failure_step6.png")

    def bv22(self):
        self.open()
        self.failure()
        self.next_times(6)
        self.expect_eq(self.text("#stageNo"), "Bước 7 / 7", "#stageNo")
        self.expect_tokens("#e-alt1", ["active"])
        self.expect_eq(self.packet_position()[:2], (987, 184), "vị trí packet sự cố bước 7")
        self.expect(self.text("#stageDesc").startswith("Mô phỏng sự cố:"), "#stageDesc phải bắt đầu Mô phỏng sự cố:")
        self.expect_tokens("#stageCallout", ["warn"])
        self.expect(self.disabled("#nextBtn"), "#nextBtn phải khóa")
        self.shot("07_failure_step7.png")

    def bv23(self):
        self.open()
        self.reset()
        self.failure()
        for step_index in range(7):
            self.expect_tokens("#e-main1", ["failed"], f"main1 ở bước {step_index + 1}")
            self.expect_tokens("#e-main2", ["failed"], f"main2 ở bước {step_index + 1}")
            if step_index >= 5:
                self.expect_tokens("#e-alt1", ["active"], f"alt1 ở bước {step_index + 1}")
                self.expect(self.text("#stageDesc").startswith("Mô phỏng sự cố:"), f"desc ở bước {step_index + 1}")
            else:
                self.expect_no_tokens("#e-alt1", ["active"], f"alt1 ở bước {step_index + 1}")
                self.expect(not self.text("#stageDesc").startswith("Mô phỏng sự cố:"), f"desc ở bước {step_index + 1}")
            if step_index < 6:
                self.next()

    def bv24(self):
        self.open()
        self.click("#autoBtn")
        self.expect_eq(self.text("#autoBtn"), "Ⅱ Tạm dừng", "#autoBtn ngay sau bấm")
        self.page.wait_for_timeout(2600)
        self.expect_eq(self.text("#stageNo"), "Bước 2 / 7", "#stageNo sau 2600ms")
        self.expect_eq(self.text("#autoBtn"), "Ⅱ Tạm dừng", "#autoBtn sau 2600ms")

    def bv25(self):
        self.open()
        self.click("#autoBtn")
        self.page.wait_for_timeout(2600)
        self.click("#autoBtn")
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn sau dừng")
        self.page.wait_for_timeout(2600)
        self.expect_eq(self.text("#stageNo"), "Bước 2 / 7", "#stageNo không đổi sau dừng")

    def bv26(self):
        self.open()
        self.next_times(6)
        self.click("#autoBtn")
        self.expect_eq(self.text("#autoBtn"), "Ⅱ Tạm dừng", "#autoBtn ngay sau bấm")
        self.page.wait_for_timeout(2600)
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn tự dừng ở cuối")
        self.expect_eq(self.text("#stageNo"), "Bước 7 / 7", "#stageNo ở cuối")

    def bv27(self):
        self.open()
        self.click("#autoBtn")
        self.page.wait_for_timeout(200)
        self.reset()
        self.page.wait_for_timeout(2600)
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn sau reset")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo sau reset")

    def bv28(self):
        self.open()
        self.click("#autoBtn")
        self.page.wait_for_timeout(200)
        self.select_mode("local")
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn sau đổi chế độ")
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 5", "#stageNo sau đổi chế độ")

    def bv29(self):
        self.open()
        self.click("#autoBtn")
        self.page.wait_for_timeout(200)
        self.failure()
        self.page.wait_for_timeout(2400)
        self.expect_eq(self.text("#autoBtn"), "Ⅱ Tạm dừng", "#autoBtn vẫn chạy")
        self.expect_eq(self.text("#stageNo"), "Bước 2 / 7", "#stageNo sau 2400ms")
        self.expect_tokens("#e-main1", ["failed"])
        self.click("#autoBtn")

    def bv30(self):
        self.open()
        self.expect_eq(
            self.text("#quizQuestion"),
            "Khi máy chủ ở ngoài subnet, laptop cần ARP để tìm MAC của ai?",
            "#quizQuestion",
        )
        self.expect_eq(
            self.texts("#quizOptions .option"),
            [
                "A. MAC của máy chủ ở Hà Nội",
                "B. MAC của default gateway trên LAN",
                "C. MAC của DNS server trong mọi trường hợp",
            ],
            "option",
        )
        options = self.page.locator("#quizOptions .option")
        for index in range(3):
            self.expect(not options.nth(index).is_disabled(), f"option {index} phải bật")
            self.expect_eq(options.nth(index).get_attribute("class"), "option", f"class option {index}")
        self.expect_eq(self.text("#quizFeedback"), "Chọn đáp án phù hợp nhất.", "#quizFeedback")

    def bv31(self):
        self.open()
        self.option(0)
        self.expect_eq(self.cls('#quizOptions .option[data-i="0"]'), "option wrong", "option A")
        self.expect_eq(self.cls('#quizOptions .option[data-i="1"]'), "option correct", "option B")
        options = self.page.locator("#quizOptions .option")
        for index in range(3):
            self.expect(options.nth(index).is_disabled(), f"option {index} phải khóa")
        self.expect(self.text("#quizFeedback").startswith("Chưa đúng. Đúng."), "#quizFeedback")
        before = self.cls('#quizOptions .option[data-i="2"]')
        self.dispatch_click('#quizOptions .option[data-i="2"]')
        self.expect_eq(self.cls('#quizOptions .option[data-i="2"]'), before, "option C sau click")
        self.shot("11_quiz_wrong_remote.png")

    def bv32(self):
        self.open()
        self.option(0)
        self.click("#quizReset")
        self.option(1)
        self.expect_eq(self.cls('#quizOptions .option[data-i="1"]'), "option correct", "option B")
        self.expect_eq(self.count("#quizOptions .option.wrong"), 0, "không option sai")
        options = self.page.locator("#quizOptions .option")
        for index in range(3):
            self.expect(options.nth(index).is_disabled(), f"option {index} phải khóa")
        self.expect(self.text("#quizFeedback").startswith("✓ Chính xác. Đúng."), "#quizFeedback")
        self.shot("12_quiz_correct_remote.png")

    def bv33(self):
        self.open()
        self.option(1)
        question = self.text("#quizQuestion")
        self.click("#quizReset")
        options = self.page.locator("#quizOptions .option")
        for index in range(3):
            self.expect(not options.nth(index).is_disabled(), f"option {index} phải bật")
            self.expect_eq(options.nth(index).get_attribute("class"), "option", f"class option {index}")
        self.expect_eq(self.text("#quizFeedback"), "Chọn đáp án phù hợp nhất.", "#quizFeedback")
        self.expect_eq(self.text("#quizQuestion"), question, "#quizQuestion")

    def bv34(self):
        self.open()
        self.select_mode("local")
        self.expect_eq(
            self.text("#quizQuestion"),
            "Khi đích cùng subnet với laptop, laptop thường tìm MAC của ai?",
            "#quizQuestion",
        )
        self.option(0)
        self.expect_eq(self.cls('#quizOptions .option[data-i="0"]'), "option correct", "option A")
        self.expect(self.text("#quizFeedback").startswith("✓ Chính xác. Đúng."), "#quizFeedback")
        self.shot("13_quiz_local_q2.png")

    def bv35(self):
        self.open()
        self.option(1)
        self.select_mode("local")
        self.expect_contains(self.text("#quizQuestion"), "Khi đích cùng subnet", "quiz local")
        self.expect_eq(self.count("#quizOptions .option:enabled"), 3, "option local bật")
        self.expect_eq(self.text("#quizFeedback"), "Chọn đáp án phù hợp nhất.", "feedback local")
        self.select_mode("remote")
        self.expect_contains(self.text("#quizQuestion"), "Khi máy chủ ở ngoài subnet", "quiz remote")
        self.expect_eq(self.count("#quizOptions .option:enabled"), 3, "option remote bật")
        self.expect_eq(self.text("#quizFeedback"), "Chọn đáp án phù hợp nhất.", "feedback remote")

    def bv36(self):
        self.open()
        first = self.mini_steps()
        self.expect_eq(len(first), 7, "số mini-step bước 1")
        self.expect("current" in first[0]["cls"], "bước 1 phần tử 0 current")
        self.expect_eq(first[0]["badge"], "1", "badge bước 1")
        self.next()
        second = self.mini_steps()
        self.expect("done" in second[0]["cls"], "bước 2 phần tử 0 done")
        self.expect_eq(second[0]["badge"], "✓", "badge bước 2 phần tử 0")
        self.expect("current" in second[1]["cls"], "bước 2 phần tử 1 current")
        self.expect_eq(second[1]["badge"], "2", "badge bước 2 phần tử 1")
        self.next_times(5)
        last = self.mini_steps()
        for index in range(6):
            self.expect("done" in last[index]["cls"], f"bước 7 phần tử {index} done")
            self.expect_eq(last[index]["badge"], "✓", f"badge bước 7 phần tử {index}")
        self.expect("current" in last[6]["cls"], "bước 7 phần tử 6 current")
        self.expect_eq(last[6]["badge"], "7", "badge bước 7 phần tử 6")

    def bv37(self):
        self.open()
        self.select_mode("local")
        first = self.mini_steps()
        self.expect_eq(len(first), 5, "số mini-step local bước 1")
        self.expect("current" in first[0]["cls"], "local bước 1 phần tử 0 current")
        self.next_times(4)
        last = self.mini_steps()
        for index in range(4):
            self.expect("done" in last[index]["cls"], f"local bước 5 phần tử {index} done")
        self.expect("current" in last[4]["cls"], "local bước 5 phần tử 4 current")
        self.expect_eq(
            [item["label"] for item in first],
            [
                "Xác định đích trong cùng subnet",
                "ARP tìm MAC của máy in",
                "Máy in trả lời ARP",
                "Frame được gửi trực tiếp trong LAN",
                "Thiết bị đích nhận dữ liệu",
            ],
            "nhãn mini-step local",
        )

    def bv38(self):
        self.open()
        self.assert_progress("remote bước 1", "1 / 7", 100 / 7)
        self.next_times(6)
        self.assert_progress("remote bước 7", "7 / 7", 100.0)
        self.select_mode("local")
        self.assert_progress("local bước 1", "1 / 5", 20.0)
        self.next_times(4)
        self.assert_progress("local bước 5", "5 / 5", 100.0)

    def bv39(self):
        self.open()
        for step_index, expected in enumerate(REMOTE_PACKETS, start=1):
            if expected is None:
                self.expect_eq(self.style_display("#packet"), "none", f"packet bước {step_index}")
            else:
                self.expect(self.style_display("#packet") != "none", f"packet bước {step_index} phải hiện")
                cx, cy, tx, ty = self.packet_position()
                self.expect_eq((cx, cy), expected, f"vị trí packet bước {step_index}")
                self.expect_eq((tx, ty), (expected[0], expected[1] + 4), f"vị trí nhãn packet bước {step_index}")
            if step_index < 7:
                self.next()

    def bv40(self):
        self.open()
        self.select_mode("local")
        for step_index, expected in enumerate(LOCAL_PACKETS, start=1):
            if expected is None:
                self.expect_eq(self.style_display("#packet"), "none", f"packet local bước {step_index}")
            else:
                self.expect(self.style_display("#packet") != "none", f"packet local bước {step_index} phải hiện")
                cx, cy, _, _ = self.packet_position()
                self.expect_eq((cx, cy), expected, f"vị trí packet local bước {step_index}")
            if step_index < 5:
                self.next()

    def bv41(self):
        self.open()
        self.next()
        self.expect_eq(self.style_display("#arpBubble"), "none", "ARP bước 2")
        self.next()
        self.expect(self.style_display("#arpBubble") != "none", "ARP bước 3 phải hiện")
        self.expect_eq(self.text("#arpText"), "ARP Request · Broadcast", "#arpText")
        self.expect_eq(self.texts("#arpBubble text")[1], "Who has 192.168.10.1?", "ARP text thứ hai")
        self.shot("14_remote_arp_stage3.png")

    def bv42(self):
        self.open()
        self.select_mode("local")
        self.expect_eq(self.style_display("#arpBubble"), "none", "ARP local bước 1")
        self.next()
        self.expect(self.style_display("#arpBubble") != "none", "ARP local bước 2 phải hiện")
        self.expect_eq(self.texts("#arpBubble text")[1], "Who has 192.168.10.50?", "ARP text local")
        self.shot("15_local_arp_stage2.png")

    def bv43(self):
        self.open()
        self.expect_tokens("#node-laptop .node", ["active"], "bước 1 laptop")
        self.expect_tokens("#node-server .node", ["active"], "bước 1 server")
        self.next()
        self.expect_tokens("#node-laptop .node", ["active"], "bước 2 laptop")
        self.expect_eq(self.cls("#node-gw .node"), "node gateway active", "bước 2 gateway")
        self.next_times(4)
        self.expect_eq(self.cls("#node-gw .node"), "node gateway active", "bước 6 gateway")
        self.expect_tokens("#node-r2 .node", ["active"], "bước 6 r2")
        self.expect_tokens("#node-r3 .node", ["active"], "bước 6 r3")
        self.next()
        self.expect_tokens("#node-server .node", ["active"], "bước 7 server")
        for selector in ["#node-laptop .node", "#node-gw .node", "#node-r2 .node", "#node-r3 .node"]:
            self.expect_no_tokens(selector, ["active"], f"bước 7 {selector}")

    def bv44(self):
        self.open()
        self.select_mode("local")
        for step_index in range(5):
            self.expect_eq(self.style_display("#node-printer"), "", f"printer bước {step_index + 1}")
            self.expect_eq(self.style_display("#e-printer"), "", f"e-printer bước {step_index + 1}")
            self.expect_no_tokens("#e-printer", ["active"], f"e-printer bước {step_index + 1}")
            self.expect_eq(self.computed_opacity("#node-server"), "0.35", f"server bước {step_index + 1}")
            self.expect_eq(self.computed_opacity("#node-r2"), "0.42", f"r2 bước {step_index + 1}")
            self.expect_eq(self.computed_opacity("#node-r3"), "0.42", f"r3 bước {step_index + 1}")
            self.expect_eq(self.computed_opacity("#node-r4"), "0.42", f"r4 bước {step_index + 1}")
            if step_index == 0:
                self.expect_tokens("#node-laptop .node", ["active"], "local bước 1 laptop")
                self.expect_tokens("#node-printer .node", ["active"], "local bước 1 printer")
            if step_index == 3:
                self.expect_tokens("#node-laptop .node", ["active"], "local bước 4 laptop")
                self.expect_tokens("#node-switch .node", ["active"], "local bước 4 switch")
                self.expect_tokens("#node-printer .node", ["active"], "local bước 4 printer")
            if step_index == 4:
                self.expect_tokens("#node-printer .node", ["active"], "local bước 5 printer")
                for selector in [
                    "#node-laptop .node",
                    "#node-switch .node",
                    "#node-gw .node",
                    "#node-r2 .node",
                    "#node-r3 .node",
                    "#node-r4 .node",
                    "#node-server .node",
                ]:
                    self.expect_no_tokens(selector, ["active"], f"local bước 5 {selector}")
                self.shot("09_local_step5.png")
            if step_index < 4:
                self.next()

    def bv45(self):
        self.open()
        headers = self.texts("#viewLegacy table.table thead th")
        self.expect_eq(headers, ["Trường", "Giá trị trong ví dụ"], "header bảng")
        for step_index in range(1, 8):
            rows = self.table_rows()
            self.expect_eq(len(rows), 4, f"số dòng bảng bước {step_index}")
            for row_index, row in enumerate(rows, start=1):
                self.expect_eq(len(row), 2, f"số cột dòng {row_index} bước {step_index}")
            if step_index in REMOTE_TABLE:
                self.expect_eq(rows, REMOTE_TABLE[step_index], f"bảng remote bước {step_index}")
            if step_index < 7:
                self.next()

    def bv46(self):
        self.open()
        self.select_mode("local")
        for step_index in range(1, 6):
            rows = self.table_rows()
            self.expect_eq(len(rows), 4, f"số dòng bảng local bước {step_index}")
            for row_index, row in enumerate(rows, start=1):
                self.expect_eq(len(row), 2, f"số cột dòng {row_index} local bước {step_index}")
            if step_index in LOCAL_TABLE:
                self.expect_eq(rows, LOCAL_TABLE[step_index], f"bảng local bước {step_index}")
            if step_index < 5:
                self.next()

    def bv47(self):
        self.open()
        self.expect_tokens("#stageCallout", ["callout"], "remote bước 1")
        self.expect_no_tokens("#stageCallout", ["warn", "good"], "remote bước 1")
        self.next_times(2)
        self.expect_tokens("#stageCallout", ["warn"], "remote bước 3")
        self.next_times(4)
        self.expect_tokens("#stageCallout", ["good"], "remote bước 7")
        self.select_mode("local")
        self.expect_tokens("#stageCallout", ["callout"], "local bước 1")
        self.expect_no_tokens("#stageCallout", ["warn", "good"], "local bước 1")
        self.next_times(2)
        self.expect_tokens("#stageCallout", ["warn"], "local bước 3")
        self.next_times(2)
        self.expect_tokens("#stageCallout", ["good"], "local bước 5")
        self.select_mode("remote")
        self.failure()
        self.next_times(5)
        self.expect_tokens("#stageCallout", ["warn"], "sự cố bước 6")
        self.next()
        self.expect_tokens("#stageCallout", ["warn"], "sự cố bước 7")

    def bv48(self):
        self.open()
        self.expect_eq(
            self.texts("#stageList li"),
            [
                "IP nguồn: 192.168.10.25/24",
                "IP đích: 203.0.113.80",
                "Đích nằm ngoài subnet nên không gửi frame trực tiếp đến máy chủ ở xa.",
            ],
            "stageList remote",
        )
        self.select_mode("local")
        self.expect_eq(
            self.texts("#stageList li"),
            [
                "IP nguồn: 192.168.10.25/24",
                "IP đích: 192.168.10.50",
                "Đích cùng subnet, nên laptop tìm MAC máy in B.",
            ],
            "stageList local",
        )

    def bv49(self):
        self.open()
        schemes = {urlparse(request["url"]).scheme for request in self.requests}
        self.expect("http" not in schemes, f"có request HTTP: {sorted(schemes)}")
        self.expect("https" not in schemes, f"có request HTTPS: {sorted(schemes)}")
        self.expect("file" in schemes, f"không có request file: {sorted(schemes)}")
        self.expect(len(self.requests) >= 3, f"quá ít request: {len(self.requests)}")

    def bv50(self):
        self.open()
        self.expect_eq(len(self.console_errors()), 0, "console error")
        self.expect_eq(len(self.page_errors), 0, "page error")

        self.next_times(6)
        self.reset()
        self.failure()
        self.next_times(6)
        self.failure()

        self.select_mode("local")
        self.next_times(4)
        self.option(0)
        self.click("#quizReset")

        self.select_mode("remote")
        self.option(0)
        self.click("#quizReset")

        self.click("#autoBtn")
        self.page.wait_for_timeout(250)
        self.click("#autoBtn")
        self.page.wait_for_timeout(250)
        self.reset()

        self.click("#tabLab")
        self.expect(self.view_active("#viewLab"), "#viewLab phải hiện")
        self.click("#tabLegacy")
        self.expect(self.view_active("#viewLegacy"), "#viewLegacy phải hiện")

        self.page.wait_for_timeout(200)
        self.expect_eq(len(self.console_errors()), 0, "console error cuối")
        self.expect_eq(len(self.page_errors), 0, "page error cuối")

    def bv51(self):
        self.open()
        self.expect_eq(self.count("#topologyEditor"), 1, "số section #topologyEditor")
        self.expect(self.count("#topologyCanvas [data-device]") >= 5, "topologyCanvas phải có phần tử [data-device]")
        self.expect(self.count("#topologyCanvas [data-link]") >= 4, "topologyCanvas phải có phần tử [data-link]")

        self.page.select_option("#topologyPreset", "enterprise")
        enterprise_ids = self.topology_device_ids()
        self.expect("hq" in enterprise_ids, "mẫu enterprise phải có thiết bị hq")
        self.expect("data" in enterprise_ids, "mẫu enterprise phải có thiết bị data")

        before = self.count("#topologyCanvas [data-device]")
        self.click("#addDeviceBtn")
        self.expect_eq(self.count("#topologyCanvas [data-device]"), before + 1, "Thêm thiết bị phải tăng số [data-device]")

        self.click("#disconnectLinkBtn")
        links = self.topology_link_states()
        self.expect(any(item["down"] for item in links), "Ngắt liên kết phải đánh dấu một liên kết DOWN")

        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo trước khi bấm proxy")
        self.click("#topologyNextProxy")
        self.expect_eq(self.text("#stageNo"), "Bước 2 / 7", "#topologyNextProxy phải tiến #stageNo")
        self.expect_contains(self.text("#topologyStageMirror"), "Bước 2 / 7", "#topologyStageMirror phải đồng bộ")
        fill = self.style_width("#topologyProgressFill")
        self.expect(fill.endswith("%"), f"#topologyProgressFill width không phải phần trăm: {fill!r}")
        self.expect(
            abs(float(fill[:-1]) - 200 / 7) < 0.01,
            f"#topologyProgressFill width ở bước 2 mong đợi {200 / 7:.4f}%, nhận {fill}",
        )

    # ------------------------------------------------------------------
    # Kiểm tra vỏ ứng dụng và thứ tự tài nguyên
    # ------------------------------------------------------------------

    def shell01(self):
        self.expect_eq(self.text("#tabLegacy"), "Hành trình cơ bản", "#tabLegacy")
        self.expect_eq(self.text("#tabLab"), "Phòng thí nghiệm", "#tabLab")
        self.expect_eq(self.attr("#tabLegacy", "class"), "tab-btn active", "#tabLegacy class")
        self.expect_eq(self.attr("#tabLab", "class"), "tab-btn", "#tabLab class")
        self.expect_eq(self.attr("#tabLegacy", "aria-selected"), "true", "tab mặc định")
        self.expect(self.view_active("#viewLegacy"), "#viewLegacy phải hiện mặc định")
        self.expect(not self.view_active("#viewLab"), "#viewLab phải ẩn mặc định")
        self.expect(self.page.locator("#lab").count() == 1, "phải có #lab")

    def shell02(self):
        self.open()
        self.next()
        step = self.text("#stageNo")
        self.click("#tabLab")
        self.expect_eq(self.attr("#tabLab", "class"), "tab-btn active", "#tabLab class")
        self.expect_eq(self.attr("#tabLegacy", "class"), "tab-btn", "#tabLegacy class")
        self.expect(self.view_active("#viewLab"), "#viewLab phải hiện")
        self.expect(not self.view_active("#viewLegacy"), "#viewLegacy phải ẩn")
        self.expect_eq(self.attr("#tabLab", "aria-selected"), "true", "#tabLab aria-selected")
        self.page.wait_for_timeout(300)
        self.shot("00_lab_view.png")
        self.click("#tabLegacy")
        self.expect(self.view_active("#viewLegacy"), "#viewLegacy phải hiện lại")
        self.expect_eq(self.text("#stageNo"), step, "trạng thái bước phải giữ nguyên")

    def shell03(self):
        self.open()
        self.next()
        step = self.text("#stageNo")
        self.click("#tabLab")
        self.page.evaluate("document.activeElement && document.activeElement.blur()")
        self.page.keyboard.press("ArrowRight")
        self.page.keyboard.press("ArrowLeft")
        self.click("#tabLegacy")
        self.expect_eq(self.text("#stageNo"), step, "phím tắt không được tác động khi xem phòng thí nghiệm")

    def shell04(self):
        self.open()
        for name in [
            "stagesRemote",
            "stagesLocal",
            "stages",
            "setNode",
            "setEdge",
            "render",
            "stopAuto",
            "drawQuiz",
            "resetQuiz",
            "step",
            "failed",
            "autoTimer",
            "quizDone",
            "qi",
        ]:
            exists = self.page.evaluate("name => Object.prototype.hasOwnProperty.call(window, name)", name)
            self.expect(not exists, f"biến {name} bị rò ra window")

    def shell05(self):
        html = self.target.read_text(encoding="utf-8")
        scripts = re.findall(r'<script\s+src="([^"]+)"', html)
        styles = re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"', html)
        self.expect_eq(scripts, SCRIPT_ORDER, "thứ tự script")
        self.expect_eq(styles, STYLE_ORDER, "thứ tự stylesheet")

    def shell06(self):
        self.open()
        self.click("#autoBtn")
        self.page.wait_for_timeout(200)
        self.click("#tabLab")
        self.expect_eq(self.text("#autoBtn"), "▶ Tự chạy", "#autoBtn phải dừng khi rời màn hình")
        self.page.wait_for_timeout(2600)
        self.expect_eq(self.text("#stageNo"), "Bước 1 / 7", "#stageNo không được tự tiến")

    def run(self):
        self.check("BV-01", "Trạng thái ban đầu của thanh bước và tiến trình", self.bv01)
        self.check("BV-02", "Sơ đồ có đủ node, edge và các lớp ẩn", self.bv02)
        self.check("BV-03", "Không có lỗi console khi tải", self.bv03)
        self.check("BV-04", "Nút Tiếp theo sang bước 2", self.bv04)
        self.check("BV-05", "Nút Trước quay về bước 1", self.bv05)
        self.check("BV-06", "Nút Trước bị khóa ở bước 1", self.bv06)
        self.check("BV-07", "Đi hết 7 bước remote", self.bv07)
        self.check("BV-08", "Nút Tiếp theo bị khóa ở bước cuối", self.bv08)
        self.check("BV-09", "Nút Làm lại đưa về bước 1", self.bv09)
        self.check("BV-10", "Làm lại tắt sự cố", self.bv10)
        self.check("BV-11", "Chế độ local giữ đúng số bước", self.bv11)
        self.check("BV-12", "Làm lại không đặt lại quiz", self.bv12)
        self.check("BV-13", "Phím mũi tên đổi bước", self.bv13)
        self.check("BV-14", "Phím mũi tên không vượt biên", self.bv14)
        self.check("BV-15", "Chuyển sang chế độ local", self.bv15)
        self.check("BV-16", "Chuyển lại chế độ remote", self.bv16)
        self.check("BV-17", "Đổi chế độ xóa sự cố và đặt lại quiz", self.bv17)
        self.check("BV-18", "Sự cố bị khóa ở chế độ local", self.bv18)
        self.check("BV-19", "Bật sự cố tuyến chính", self.bv19)
        self.check("BV-20", "Tắt sự cố tuyến chính", self.bv20)
        self.check("BV-21", "Sự cố ở bước 6 dùng tuyến dự phòng", self.bv21)
        self.check("BV-22", "Sự cố ở bước 7 giữ tuyến dự phòng", self.bv22)
        self.check("BV-23", "Sự cố giữ liên kết lỗi qua mọi bước", self.bv23)
        self.check("BV-24", "Tự chạy tiến bước", self.bv24)
        self.check("BV-25", "Tạm dừng tự chạy", self.bv25)
        self.check("BV-26", "Tự chạy dừng ở bước cuối", self.bv26)
        self.check("BV-27", "Làm lại dừng tự chạy", self.bv27)
        self.check("BV-28", "Đổi chế độ dừng tự chạy", self.bv28)
        self.check("BV-29", "Bật sự cố không dừng tự chạy", self.bv29)
        self.check("BV-30", "Quiz remote mặc định", self.bv30)
        self.check("BV-31", "Trả lời sai quiz remote", self.bv31)
        self.check("BV-32", "Làm lại rồi trả lời đúng quiz remote", self.bv32)
        self.check("BV-33", "Đặt lại quiz", self.bv33)
        self.check("BV-34", "Quiz local và đáp án đúng", self.bv34)
        self.check("BV-35", "Đổi chế độ đặt lại quiz", self.bv35)
        self.check("BV-36", "Mini-step remote", self.bv36)
        self.check("BV-37", "Mini-step local", self.bv37)
        self.check("BV-38", "Thanh tiến trình ở hai chế độ", self.bv38)
        self.check("BV-39", "Vị trí packet remote", self.bv39)
        self.check("BV-40", "Vị trí packet local", self.bv40)
        self.check("BV-41", "Bong bóng ARP remote", self.bv41)
        self.check("BV-42", "Bong bóng ARP local", self.bv42)
        self.check("BV-43", "Node active remote", self.bv43)
        self.check("BV-44", "Node active local", self.bv44)
        self.check("BV-45", "Bảng packet remote", self.bv45)
        self.check("BV-46", "Bảng packet local", self.bv46)
        self.check("BV-47", "Callout theo bước và sự cố", self.bv47)
        self.check("BV-48", "Danh sách gạch đầu dòng", self.bv48)
        self.check("BV-49", "Không tải tài nguyên mạng", self.bv49)
        self.check("BV-50", "Kịch bản đầy đủ không lỗi", self.bv50)
        self.check("BV-51", "Trình soạn topology: sơ đồ, thêm thiết bị, ngắt liên kết và điều khiển đồng bộ", self.bv51)
        self.check("SHELL-01", "Tab mặc định và vùng #lab", self.shell01)
        self.check("SHELL-02", "Chuyển tab giữ nguyên trạng thái", self.shell02)
        self.check("SHELL-03", "Phím tắt không tác động ngoài màn hình cơ bản", self.shell03)
        self.check("SHELL-04", "Không rò biến toàn cục", self.shell04)
        self.check("SHELL-05", "Thứ tự script và stylesheet", self.shell05)
        self.check("SHELL-06", "Rời màn hình dừng tự chạy", self.shell06)


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Kiểm tra phần mô phỏng cơ bản bằng Playwright.")
    parser.add_argument(
        "target",
        nargs="?",
        default=str(APP_DIR / "index.html"),
        help="Tệp index.html cần kiểm tra (mặc định: app/index.html).",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Bỏ qua lỗi console do tệp chưa được tạo trong lúc hoàn thiện.",
    )
    parser.add_argument("--headed", action="store_true", help="Hiện cửa sổ trình duyệt.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    target = Path(args.target).resolve()
    if not target.is_file():
        print(f"Không tìm thấy tệp: {target}")
        return 2

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        page = browser.new_page(viewport={"width": 1500, "height": 1100})
        harness = Harness(page, target, args.allow_missing)
        try:
            harness.run()
        except Exception as error:
            print(f"Lỗi không mong đợi khi chạy kiểm tra: {type(error).__name__}: {error}")
            return 2
        finally:
            browser.close()

    passed = sum(1 for result in harness.results if result[2])
    total = len(harness.results)
    console_errors = harness.console_errors()
    raw_errors = harness.raw_console_errors()
    ignored = len(raw_errors) - len(console_errors)

    print("")
    print(f"{'Mã':<9} {'Kết quả':<8} Mô tả")
    print("-" * 100)
    for code, description, ok, detail in harness.results:
        status = "PASS" if ok else "FAIL"
        print(f"{code:<9} {status:<8} {description}")
        if detail:
            print(f"{'':<18} -> {detail}")
    print("-" * 100)
    print(f"Kiểm tra hành vi: {passed}/{total} đạt")
    print(f"Console error: {len(raw_errors)} phát hiện, {ignored} bỏ qua do thiếu tệp, {len(console_errors)} còn lại")
    print(f"Page error: {len(harness.page_errors)}")
    for error in harness.page_errors:
        print(f"  pageerror: {error}")
    for message in console_errors:
        print(f"  console: {message['text']} [{message['url']}]")
    print(f"Ảnh chụp: {len(harness.screenshots)} -> {SCREENSHOT_DIR}")

    ok = passed == total and not console_errors and not harness.page_errors
    print("legacy_check: " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
