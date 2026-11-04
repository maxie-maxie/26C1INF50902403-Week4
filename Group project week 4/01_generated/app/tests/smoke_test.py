# -*- coding: utf-8 -*-
"""
tests/smoke_test.py
Kiểm thử khói (smoke test) bằng Playwright – Chromium.

Mở ứng dụng qua file://, kiểm tra:
  1. Không có lỗi console hay lỗi trang (hard zero).
  2. Chuyển sang tab "Phòng thí nghiệm", chọn kịch bản ref_hai_router,
     chạy ping (#labRun), tiến 3 bước (#labForward), lùi 1 bước (#labBack),
     kiểm tra bộ đếm #labCounter hiển thị "Bước 2 / …".
  3. Kiểm tra panel "Kiểm tra gói tin" (Packet Inspector) hiển thị địa chỉ
     MAC (bắt đầu bằng "02:") và địa chỉ IP.
  4. Chuyển về tab "Hành trình cơ bản" và nhấn #nextBtn một lần,
     kiểm tra giai đoạn tiến lên (số bước tăng).
  5. Lưu ảnh chụp màn hình vào tests/artifacts/.

Chạy: python tests/smoke_test.py   (từ thư mục gốc của app)
"""

import os
import sys
import pathlib
import re

from playwright.sync_api import sync_playwright, Error as PlaywrightError

APP_DIR   = pathlib.Path(__file__).parent.parent.resolve()
INDEX_URL = (APP_DIR / "index.html").as_uri()
ARTIFACTS = APP_DIR / "tests" / "artifacts"

ARTIFACTS.mkdir(parents=True, exist_ok=True)

_errors = []

def fail(msg: str) -> None:
    """Ghi nhận lỗi vào danh sách; không dừng ngay để chụp ảnh chẩn đoán."""
    _errors.append(msg)
    print(f"[FAIL] {msg}", flush=True)

def ok(msg: str) -> None:
    print(f"[OK]   {msg}", flush=True)


def run_smoke(playwright) -> None:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()

    # Thu thập lỗi console và lỗi trang
    console_errors: list[str] = []
    page_errors:    list[str] = []

    page = context.new_page()
    page.on("console",    lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror",  lambda exc: page_errors.append(str(exc)))

    # ── Bước 1: mở trang ──────────────────────────────────────────────────────
    page.goto(INDEX_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(600)

    if console_errors:
        for e in console_errors:
            fail(f"Lỗi console: {e}")
    else:
        ok("Không có lỗi console khi tải trang.")

    if page_errors:
        for e in page_errors:
            fail(f"Lỗi trang: {e}")
    else:
        ok("Không có lỗi trang khi tải trang.")

    page.screenshot(path=str(ARTIFACTS / "01_trang_chu.png"))
    ok("Chụp ảnh: 01_trang_chu.png")

    # ── Bước 2: chuyển sang tab "Phòng thí nghiệm" ────────────────────────────
    lab_tab = page.locator("#tabLab")
    lab_tab.click()
    page.wait_for_timeout(400)

    page.screenshot(path=str(ARTIFACTS / "02_tab_phong_thi_nghiem.png"))
    ok("Chụp ảnh: 02_tab_phong_thi_nghiem.png")

    # ── Bước 3: chọn kịch bản ref_hai_router ──────────────────────────────────
    scenario_sel = page.locator("#labScenario")
    scenario_sel.select_option(value="ref_hai_router")
    page.wait_for_timeout(400)

    ok("Đã chọn kịch bản ref_hai_router.")

    # ── Bước 4: chạy ping (#labRun) ───────────────────────────────────────────
    run_btn = page.locator("#labRun")
    run_btn.click()
    page.wait_for_timeout(400)

    page.screenshot(path=str(ARTIFACTS / "03_sau_khi_chay.png"))
    ok("Chụp ảnh: 03_sau_khi_chay.png")

    # ── Bước 5: tiến 3 lần (#labForward) ─────────────────────────────────────
    forward_btn = page.locator("#labForward")
    for _ in range(3):
        forward_btn.click()
        page.wait_for_timeout(150)

    # ── Bước 6: lùi 1 lần (#labBack) ─────────────────────────────────────────
    back_btn = page.locator("#labBack")
    back_btn.click()
    page.wait_for_timeout(200)

    # ── Bước 7: kiểm tra bộ đếm ──────────────────────────────────────────────
    counter_text = page.locator("#labCounter").inner_text()
    # Kỳ vọng: "Bước 2 / N" với N là tổng số bước
    if re.match(r"Bước 2 /", counter_text):
        ok(f"Bộ đếm đúng: {counter_text!r}")
    else:
        fail(f"Bộ đếm sai: kỳ vọng 'Bước 2 / …' nhưng nhận được {counter_text!r}")

    page.screenshot(path=str(ARTIFACTS / "04_buoc_2.png"))
    ok("Chụp ảnh: 04_buoc_2.png")

    # ── Bước 8: kiểm tra Packet Inspector hiển thị MAC và IP ─────────────────
    inspector_text = page.locator(".lab-inspector").inner_text()
    if "02:" in inspector_text:
        ok("Packet Inspector hiển thị địa chỉ MAC (bắt đầu bằng '02:').")
    else:
        fail(f"Packet Inspector không hiển thị địa chỉ MAC (02:). Nội dung: {inspector_text[:200]!r}")

    # Kiểm tra có địa chỉ IP (dạng x.x.x.x)
    if re.search(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", inspector_text):
        ok("Packet Inspector hiển thị địa chỉ IP.")
    else:
        fail(f"Packet Inspector không hiển thị địa chỉ IP. Nội dung: {inspector_text[:200]!r}")

    page.screenshot(path=str(ARTIFACTS / "05_packet_inspector.png"))
    ok("Chụp ảnh: 05_packet_inspector.png")

    # ── Bước 9: chuyển về tab "Hành trình cơ bản" ────────────────────────────
    legacy_tab = page.locator("#tabLegacy")
    legacy_tab.click()
    page.wait_for_timeout(300)

    # Lấy số giai đoạn trước khi nhấn next
    stage_before = page.locator("#stageNo").inner_text()

    # Nhấn #nextBtn một lần
    next_btn = page.locator("#nextBtn")
    next_btn.click()
    page.wait_for_timeout(300)

    stage_after = page.locator("#stageNo").inner_text()

    # Kiểm tra giai đoạn đã tiến lên (số thứ tự tăng)
    match_before = re.search(r"(\d+)", stage_before)
    match_after  = re.search(r"(\d+)", stage_after)
    if match_before and match_after:
        n_before = int(match_before.group(1))
        n_after  = int(match_after.group(1))
        if n_after > n_before:
            ok(f"Giai đoạn tiến lên: {stage_before!r} → {stage_after!r}")
        else:
            fail(f"Giai đoạn không tiến: {stage_before!r} → {stage_after!r}")
    else:
        fail(f"Không đọc được số giai đoạn: trước={stage_before!r} sau={stage_after!r}")

    page.screenshot(path=str(ARTIFACTS / "06_hanh_trinh_co_ban.png"))
    ok("Chụp ảnh: 06_hanh_trinh_co_ban.png")

    # ── Bước 10: kiểm tra lần cuối không có lỗi mới ───────────────────────────
    if console_errors:
        for e in console_errors:
            fail(f"Lỗi console (tích lũy): {e}")
    if page_errors:
        for e in page_errors:
            fail(f"Lỗi trang (tích lũy): {e}")

    context.close()
    browser.close()


def main() -> int:
    with sync_playwright() as pw:
        try:
            run_smoke(pw)
        except PlaywrightError as exc:
            fail(f"Playwright lỗi không phục hồi: {exc}")
        except Exception as exc:  # noqa: BLE001
            fail(f"Lỗi không mong đợi: {exc}")

    total  = len(_errors)
    passed = 0 if total else 1  # ít nhất đã chạy xong
    if total == 0:
        print(f"\nsmoke_test: tất cả kiểm thử đạt, 0 lỗi.", flush=True)
        return 0
    else:
        print(f"\nsmoke_test: {total} lỗi.", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
