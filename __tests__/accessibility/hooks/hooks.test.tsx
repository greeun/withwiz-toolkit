// @vitest-environment jsdom
/**
 * Hooks 모듈 테스트
 *
 * 테스트 범위:
 * - useDebounce: 디바운싱 지연, 연속 변경 처리, cleanup
 * - useTimezone: 타임존 감지, 오프셋 포맷팅, SSR 호환성
 * - useExitIntent: Exit Intent 감지, localStorage 관리, cooldown
 * - useDataTable: 필터/정렬/페이지네이션/선택 상태 관리
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useDebounce } from "@withwiz/hooks/useDebounce";
import { useTimezone, useSimpleTimezone } from "@withwiz/hooks/useTimezone";
import { useExitIntent } from "@withwiz/hooks/useExitIntent";
import { useDataTable } from "@withwiz/hooks/useDataTable";
import * as timezoneUtils from "@withwiz/utils/timezone";

// Mock timezone utils
vi.mock("@withwiz/utils/timezone", () => ({
  getUserTimezone: vi.fn(() => "Asia/Seoul"),
  getTimezoneOffset: vi.fn(() => -540), // UTC+9 = -540 minutes
}));

// Mock timers
vi.useFakeTimers();

describe("Hooks Module", () => {
  describe("useDebounce", () => {
    afterEach(() => {
      vi.clearAllTimers();
    });

    it("should return initial value immediately", () => {
      const { result } = renderHook(() => useDebounce("initial", 500));

      expect(result.current).toBe("initial");
    });

    it("should update value after delay", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 500 },
        },
      );

      expect(result.current).toBe("first");

      // Update value
      rerender({ value: "second", delay: 500 });

      // Immediate check returns previous value
      expect(result.current).toBe("first");

      // Update after 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe("second");
    });

    it("should debounce rapid changes and use last value", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 300 },
        },
      );

      // Rapid sequential changes
      rerender({ value: "second", delay: 300 });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender({ value: "third", delay: 300 });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender({ value: "fourth", delay: 300 });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Not updated yet
      expect(result.current).toBe("first");

      // 300ms elapsed since last change
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Only reflects the last value
      expect(result.current).toBe("fourth");
    });

    it("should cleanup timer on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 500 },
        },
      );

      rerender({ value: "second", delay: 500 });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it("should handle same value without creating timer", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const initialCallCount = setTimeoutSpy.mock.calls.length;

      const { rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "same", delay: 500 },
        },
      );

      // rerender with same value
      rerender({ value: "same", delay: 500 });

      // setTimeout not called additionally
      expect(setTimeoutSpy.mock.calls.length).toBe(initialCallCount);

      setTimeoutSpy.mockRestore();
    });

    it("should work with different data types", () => {
      // Number
      const { result: numberResult, rerender: numberRerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 100, delay: 200 },
        },
      );

      numberRerender({ value: 200, delay: 200 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(numberResult.current).toBe(200);

      // Object
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const { result: objectResult, rerender: objectRerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: obj1, delay: 200 },
        },
      );

      objectRerender({ value: obj2, delay: 200 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(objectResult.current).toBe(obj2);
    });
  });

  describe("useTimezone", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    it("should return timezone information", async () => {
      const { result } = renderHook(() => useTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.timezone).toBe("Asia/Seoul");
      expect(result.current.offset).toBe(-540);
      expect(result.current.offsetFormatted).toBe("+09:00");
    });

    it("should format offset correctly for positive timezone", async () => {
      const getUserTimezone = vi.mocked(timezoneUtils.getUserTimezone);
      const getTimezoneOffset = vi.mocked(timezoneUtils.getTimezoneOffset);

      getUserTimezone.mockReturnValue("America/New_York");
      getTimezoneOffset.mockReturnValue(300); // UTC-5 = +300 minutes

      const { result } = renderHook(() => useTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.timezone).toBe("America/New_York");
      expect(result.current.offset).toBe(300);
      expect(result.current.offsetFormatted).toBe("-05:00");
    });

    it("should format offset with minutes correctly", async () => {
      const getUserTimezone = vi.mocked(timezoneUtils.getUserTimezone);
      const getTimezoneOffset = vi.mocked(timezoneUtils.getTimezoneOffset);

      getUserTimezone.mockReturnValue("Asia/Kolkata");
      getTimezoneOffset.mockReturnValue(-330); // UTC+5:30 = -330 minutes

      const { result } = renderHook(() => useTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.offsetFormatted).toBe("+05:30");
    });

    it("should handle UTC timezone", async () => {
      const getUserTimezone = vi.mocked(timezoneUtils.getUserTimezone);
      const getTimezoneOffset = vi.mocked(timezoneUtils.getTimezoneOffset);

      getUserTimezone.mockReturnValue("UTC");
      getTimezoneOffset.mockReturnValue(0);

      const { result } = renderHook(() => useTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.timezone).toBe("UTC");
      expect(result.current.offset).toBe(0);
      expect(result.current.offsetFormatted).toBe("+00:00");
    });

    it("should fallback to UTC on error", async () => {
      const getUserTimezone = vi.mocked(timezoneUtils.getUserTimezone);

      getUserTimezone.mockImplementation(() => {
        throw new Error("Timezone detection failed");
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.timezone).toBe("UTC");
      expect(result.current.offset).toBe(0);
      expect(result.current.offsetFormatted).toBe("+00:00");
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("should refresh timezone information", async () => {
      const getUserTimezone = vi.mocked(timezoneUtils.getUserTimezone);
      const getTimezoneOffset = vi.mocked(timezoneUtils.getTimezoneOffset);

      getUserTimezone.mockReturnValue("Asia/Seoul");
      getTimezoneOffset.mockReturnValue(-540);

      const { result } = renderHook(() => useTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.timezone).toBe("Asia/Seoul");

      // Mock Change timezone
      getUserTimezone.mockReturnValue("Europe/London");
      getTimezoneOffset.mockReturnValue(0);

      act(() => {
        result.current.refreshTimezone();
      });

      expect(result.current.timezone).toBe("Europe/London");
      expect(result.current.offsetFormatted).toBe("+00:00");
    });
  });

  describe("useSimpleTimezone", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it("should return simple timezone display", async () => {
      const getUserTimezone = vi.mocked(timezoneUtils.getUserTimezone);
      const getTimezoneOffset = vi.mocked(timezoneUtils.getTimezoneOffset);

      getUserTimezone.mockReturnValue("Asia/Tokyo");
      getTimezoneOffset.mockReturnValue(-540);

      const { result } = renderHook(() => useSimpleTimezone());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.timezone).toBe("Asia/Tokyo");
      expect(result.current.offsetFormatted).toBe("+09:00");
      expect(result.current.display).toBe("Asia/Tokyo (+09:00)");
    });
  });

  describe("useExitIntent", () => {
    let localStorageMock: { [key: string]: string };
    let getItemSpy: MockInstance;
    let setItemSpy: MockInstance;

    beforeEach(() => {
      localStorageMock = {};

      getItemSpy = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation((key: string) => {
          return localStorageMock[key] || null;
        });

      setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation((key: string, value: string) => {
          localStorageMock[key] = value;
        });

      // Mock document
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        value: "visible",
      });

      vi.clearAllTimers();
    });

    afterEach(() => {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
      vi.clearAllTimers();
    });

    it("should not show popup initially", () => {
      const { result } = renderHook(() => useExitIntent());

      expect(result.current.showPopup).toBe(false);
    });

    it("should activate after delay", () => {
      const { result } = renderHook(() => useExitIntent({ delay: 1000 }));

      // 즉시는 비활성
      const event = new MouseEvent("mouseleave", { clientY: 5 });
      act(() => {
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(false);

      // Active after delay
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const event2 = new MouseEvent("mouseleave", { clientY: 5 });
      act(() => {
        document.dispatchEvent(event2);
      });

      expect(result.current.showPopup).toBe(true);
    });

    it("should trigger on mouse leave at top (y < 10)", () => {
      const { result } = renderHook(() => useExitIntent({ delay: 0 }));

      // Delay elapsed (isReady activated)
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Mouse move to top (y < 10)
      act(() => {
        const event = new MouseEvent("mouseleave", { clientY: 5 });
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(true);
      expect(setItemSpy).toHaveBeenCalledWith(
        "exit-intent-popup-last-shown",
        expect.any(String),
      );
    });

    it("should not trigger on mouse leave at middle (y >= 10)", () => {
      const { result } = renderHook(() => useExitIntent({ delay: 0 }));

      act(() => {
        vi.runAllTimers();
      });

      // Middle area (y >= 10)
      const event = new MouseEvent("mouseleave", { clientY: 100 });
      act(() => {
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(false);
    });

    it("should close popup", () => {
      const { result } = renderHook(() => useExitIntent({ delay: 0 }));

      // Delay elapsed
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Trigger popup
      act(() => {
        const event = new MouseEvent("mouseleave", { clientY: 5 });
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(true);

      // Close popup
      act(() => {
        result.current.closePopup();
      });

      expect(result.current.showPopup).toBe(false);
    });

    it("should dismiss forever", () => {
      const { result } = renderHook(() =>
        useExitIntent({ delay: 0, storageKey: "test-popup" }),
      );

      // delay 경과
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Trigger popup
      act(() => {
        const event = new MouseEvent("mouseleave", { clientY: 5 });
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(true);

      // Dismiss forever
      act(() => {
        result.current.dismissForever();
      });

      expect(result.current.showPopup).toBe(false);
      expect(setItemSpy).toHaveBeenCalledWith("test-popup-dismissed", "true");
    });

    it("should respect cooldown period", () => {
      const cooldown = 1000; // 1초
      const now = Date.now();

      // Record of recently shown
      localStorageMock["exit-intent-popup-last-shown"] = (now - 500).toString();

      const { result } = renderHook(() =>
        useExitIntent({ delay: 0, cooldown }),
      );

      act(() => {
        vi.runAllTimers();
      });

      // Trigger attempt
      const event = new MouseEvent("mouseleave", { clientY: 5 });
      act(() => {
        document.dispatchEvent(event);
      });

      // Not shown because it's within cooldown period
      expect(result.current.showPopup).toBe(false);
    });

    it("should not trigger when dismissed forever", () => {
      localStorageMock["exit-intent-popup-dismissed"] = "true";

      const { result } = renderHook(() => useExitIntent({ delay: 0 }));

      act(() => {
        vi.runAllTimers();
      });

      const event = new MouseEvent("mouseleave", { clientY: 5 });
      act(() => {
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(false);
    });

    it("should not trigger when disabled", () => {
      const { result } = renderHook(() =>
        useExitIntent({ delay: 0, disabled: true }),
      );

      act(() => {
        vi.runAllTimers();
      });

      const event = new MouseEvent("mouseleave", { clientY: 5 });
      act(() => {
        document.dispatchEvent(event);
      });

      expect(result.current.showPopup).toBe(false);
    });

    it("should cleanup event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(
        document,
        "removeEventListener",
      );

      const { unmount } = renderHook(() => useExitIntent());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mouseleave",
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("useDataTable", () => {
    beforeEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers(); // useDataTable uses real timers
    });

    afterEach(() => {
      vi.clearAllTimers();
    });

    it("should initialize with default values", () => {
      const { result } = renderHook(() => useDataTable({}));

      expect(result.current.data).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.filters).toEqual({});
      expect(result.current.sort).toEqual({ sort: "createdAt", order: "desc" });
      expect(result.current.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 0,
      });
      expect(result.current.selectedIds).toEqual([]);
    });

    it("should update filter and reset page to 1", async () => {
      const mockOnDataChange = vi.fn(() => Promise.resolve());

      const { result } = renderHook(() =>
        useDataTable({
          initialPagination: { page: 5, pageSize: 10, total: 100 },
          onDataChange: mockOnDataChange,
        }),
      );

      // refresh() is called in useMemo, so initial page can change
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Manually set current page to 5
      act(() => {
        result.current.setPage(5);
      });

      await waitFor(() => {
        expect(result.current.pagination.page).toBe(5);
      });

      act(() => {
        result.current.updateFilter("status", "active");
      });

      expect(result.current.filters.status).toBe("active");

      await waitFor(() => {
        expect(result.current.pagination.page).toBe(1); // Page reset
      });
    });

    it("should reset page when search filter changes (via useMemo)", async () => {
      const mockOnDataChange = vi.fn(() => Promise.resolve());

      const { result } = renderHook(() =>
        useDataTable({
          initialPagination: { page: 1, pageSize: 10, total: 50 },
          onDataChange: mockOnDataChange,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Set page to 3
      act(() => {
        result.current.setPage(3);
      });

      await waitFor(() => {
        expect(result.current.pagination.page).toBe(3);
      });

      // Update search query
      act(() => {
        result.current.updateFilter("search", "test query");
      });

      expect(result.current.filters.search).toBe("test query");

      // useMemo resets page to 1 when filters.search changes
      // (updateFilter does not reset page, but useMemo does)
      await waitFor(() => {
        expect(result.current.pagination.page).toBe(1);
      });
    });

    it("should toggle sort order when same column", () => {
      const { result } = renderHook(() =>
        useDataTable({
          initialSort: { sort: "name", order: "asc" },
        }),
      );

      expect(result.current.sort).toEqual({ sort: "name", order: "asc" });

      act(() => {
        result.current.setSort("name");
      });

      expect(result.current.sort).toEqual({ sort: "name", order: "desc" });

      act(() => {
        result.current.setSort("name");
      });

      expect(result.current.sort).toEqual({ sort: "name", order: "asc" });
    });

    it("should set asc order when sorting new column", () => {
      const { result } = renderHook(() =>
        useDataTable({
          initialSort: { sort: "name", order: "desc" },
        }),
      );

      act(() => {
        result.current.setSort("email");
      });

      expect(result.current.sort).toEqual({ sort: "email", order: "asc" });
      expect(result.current.pagination.page).toBe(1); // Page reset
    });

    it("should set page correctly", () => {
      const { result } = renderHook(() => useDataTable({}));

      act(() => {
        result.current.setPage(3);
      });

      expect(result.current.pagination.page).toBe(3);
    });

    it("should set page size and reset page to 1", () => {
      const { result } = renderHook(() =>
        useDataTable({
          initialPagination: { page: 5, pageSize: 10, total: 100 },
        }),
      );

      act(() => {
        result.current.setPageSize(20);
      });

      expect(result.current.pagination.pageSize).toBe(20);
      expect(result.current.pagination.page).toBe(1); // Page reset
    });

    it("should toggle selection", () => {
      const { result } = renderHook(() => useDataTable({}));

      act(() => {
        result.current.toggleSelection("item-1");
      });

      expect(result.current.selectedIds).toEqual(["item-1"]);

      act(() => {
        result.current.toggleSelection("item-2");
      });

      expect(result.current.selectedIds).toEqual(["item-1", "item-2"]);

      act(() => {
        result.current.toggleSelection("item-1");
      });

      expect(result.current.selectedIds).toEqual(["item-2"]);
    });

    it("should select all items", () => {
      const { result } = renderHook(() => useDataTable({}));

      const mockData = [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
        { id: "3", name: "Item 3" },
      ];

      act(() => {
        result.current.setData(mockData);
      });

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedIds).toEqual(["1", "2", "3"]);
    });

    it("should clear selection", () => {
      const { result } = renderHook(() => useDataTable({}));

      act(() => {
        result.current.setSelectedIds(["item-1", "item-2"]);
      });

      expect(result.current.selectedIds).toEqual(["item-1", "item-2"]);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedIds).toEqual([]);
    });

    it("should clear filters and reset page", () => {
      const { result } = renderHook(() =>
        useDataTable({
          initialFilters: { status: "active", category: "tech" },
          initialPagination: { page: 3, pageSize: 10, total: 50 },
        }),
      );

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
        status: "active",
        category: "tech",
      }); // Resets to initialFilters
      expect(result.current.pagination.page).toBe(1);
    });

    it("should execute bulk action and clear selection", async () => {
      const mockAction = vi.fn(() => Promise.resolve());
      const mockOnDataChange = vi.fn(() => Promise.resolve());

      const { result } = renderHook(() =>
        useDataTable({
          onDataChange: mockOnDataChange,
        }),
      );

      act(() => {
        result.current.setSelectedIds(["1", "2", "3"]);
      });

      await act(async () => {
        await result.current.bulkAction(mockAction);
      });

      expect(mockAction).toHaveBeenCalledWith(["1", "2", "3"]);
      expect(result.current.selectedIds).toEqual([]); // Selection cleared
    });

    it("should not execute bulk action when no selection", async () => {
      const mockAction = vi.fn(() => Promise.resolve());

      const { result } = renderHook(() => useDataTable({}));

      await act(async () => {
        await result.current.bulkAction(mockAction);
      });

      expect(mockAction).not.toHaveBeenCalled();
    });

    it("should handle bulk action error", async () => {
      const mockAction = vi.fn(() =>
        Promise.reject(new Error("Bulk action failed")),
      );

      const { result } = renderHook(() => useDataTable({}));

      act(() => {
        result.current.setSelectedIds(["1", "2"]);
      });

      await act(async () => {
        await result.current.bulkAction(mockAction);
      });

      expect(result.current.error).toBe("Bulk action failed");
      expect(result.current.loading).toBe(false);
    });

    it("should set data, loading, error, total", () => {
      const { result } = renderHook(() => useDataTable({}));

      const mockData = [{ id: "1", name: "Item" }];

      act(() => {
        result.current.setData(mockData);
        result.current.setLoading(true);
        result.current.setError("Test error");
        result.current.setTotal(100);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe("Test error");
      expect(result.current.total).toBe(100);
    });
  });
});
