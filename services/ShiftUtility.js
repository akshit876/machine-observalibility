import { parse, isAfter, isBefore, addDays, format, set } from "date-fns";

class ShiftUtility {
  constructor(shiftConfig = null) {
    this.shiftConfig = shiftConfig || {
      A: { start: "06:00", end: "14:30" },
      B: { start: "14:30", end: "23:00" },
      C: { start: "23:00", end: "06:00" },
    };
  }

  setShiftConfig(newConfig) {
    this.shiftConfig = { ...this.shiftConfig, ...newConfig };
  }

  getCurrentShift(currentTime = new Date()) {
    for (const [shift, times] of Object.entries(this.shiftConfig)) {
      const start = this._parseTime(times.start, currentTime);
      let end = this._parseTime(times.end, currentTime);

      // Handle overnight shifts
      if (isBefore(end, start)) {
        end = addDays(end, 1);
        if (isBefore(currentTime, start)) {
          currentTime = addDays(currentTime, 1);
        }
      }

      if (
        (isAfter(currentTime, start) ||
          currentTime.getTime() === start.getTime()) &&
        isBefore(currentTime, end)
      ) {
        return shift;
      }
    }

    // If no shift is found (shouldn't happen with 24-hour coverage)
    return "Unknown";
  }

  getNextShift(currentShift) {
    const shifts = Object.keys(this.shiftConfig);
    const currentIndex = shifts.indexOf(currentShift);
    return shifts[(currentIndex + 1) % shifts.length];
  }

  getShiftStartTime(shift) {
    return this.shiftConfig[shift].start;
  }

  getShiftEndTime(shift) {
    return this.shiftConfig[shift].end;
  }

  _parseTime(timeString, baseDate) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return set(baseDate, { hours, minutes, seconds: 0, milliseconds: 0 });
  }
}

// Usage example
// const shiftUtil = new ShiftUtility();

// console.log(shiftUtil.getCurrentShift()); // Returns current shift based on system time

// // Example of changing shift timings
// shiftUtil.setShiftConfig({
//     A: { start: "07:00", end: "15:30" },
//     B: { start: "15:30", end: "23:30" },
//     C: { start: "23:30", end: "07:00" },
// });

// console.log(shiftUtil.getCurrentShift(new Date("2023-05-01T16:00:00"))); // Should return 'B'
// console.log(shiftUtil.getNextShift("B")); // Should return 'C'
// console.log(shiftUtil.getShiftStartTime("A")); // Should return '07:00'

export default ShiftUtility;
