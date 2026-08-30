import { describe, it, expect } from "vitest";
import { adjustTime } from "../../src/media/videoControls.js";
import { clamp } from "../../src/utils/math.js";

describe("clamp", () => {
  it("範囲内はそのまま返す", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("下限・上限でクランプする", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("境界値はそのまま返す", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("adjustTime", () => {
  it("早送りで currentTime が加算される", () => {
    const video = { currentTime: 5, duration: 30 };
    adjustTime(video, 10);
    expect(video.currentTime).toBe(15);
  });

  it("巻戻しで currentTime が減算される", () => {
    const video = { currentTime: 20, duration: 30 };
    adjustTime(video, -10);
    expect(video.currentTime).toBe(10);
  });

  it("先頭より前には戻らない", () => {
    const video = { currentTime: 3, duration: 30 };
    adjustTime(video, -10);
    expect(video.currentTime).toBe(0);
  });

  it("末尾より先には進まない", () => {
    const video = { currentTime: 25, duration: 30 };
    adjustTime(video, 10);
    expect(video.currentTime).toBe(30);
  });
});
