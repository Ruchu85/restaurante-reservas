import { describe, it, expect } from "vitest";
import { computeAvailableSlots } from "@/lib/availability";
import type { Service, StaffMember, BusinessHours, Appointment } from "@/types";

const SALON_ID = "salon-1";
const STAFF_ID = "staff-1";
const SERVICE_ID = "svc-1";

const baseService: Service = {
  id: SERVICE_ID,
  salon_id: SALON_ID,
  name: "Corte",
  description: null,
  duration_minutes: 60,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  price_cents: 2500,
  active: true,
  created_at: "",
  updated_at: "",
};

const baseStaff: StaffMember = {
  id: STAFF_ID,
  salon_id: SALON_ID,
  profile_id: null,
  display_name: "María",
  bio: null,
  avatar_url: null,
  active: true,
  created_at: "",
  updated_at: "",
};

// Monday 2026-06-01
const TEST_DATE = "2026-06-01";
const MONDAY_HOURS: BusinessHours = {
  id: "bh-1",
  salon_id: SALON_ID,
  staff_id: null,
  day_of_week: 1, // Monday
  open_time: "09:00",
  close_time: "18:00",
  is_open: true,
};

describe("computeAvailableSlots", () => {
  it("returns slots within business hours", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: baseService,
      businessHours: [MONDAY_HOURS],
      staffMembers: [baseStaff],
      existingAppointments: [],
      staffTimeOffs: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    // All slots should start at or after 09:00
    slots.forEach((slot) => {
      expect(slot.starts_at.getHours()).toBeGreaterThanOrEqual(9);
    });
    // No slot should end after 18:00
    slots.forEach((slot) => {
      const endH = slot.ends_at.getHours();
      const endM = slot.ends_at.getMinutes();
      expect(endH * 60 + endM).toBeLessThanOrEqual(18 * 60);
    });
  });

  it("returns no slots when salon is closed", () => {
    const closedHours: BusinessHours = { ...MONDAY_HOURS, is_open: false };
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: baseService,
      businessHours: [closedHours],
      staffMembers: [baseStaff],
      existingAppointments: [],
      staffTimeOffs: [],
    });
    expect(slots).toHaveLength(0);
  });

  it("excludes slots that conflict with existing appointments", () => {
    const existingStart = new Date(`${TEST_DATE}T10:00:00`);
    const existingEnd = new Date(`${TEST_DATE}T11:00:00`);

    const existingAppt: Appointment = {
      id: "appt-1",
      salon_id: SALON_ID,
      staff_id: STAFF_ID,
      service_id: SERVICE_ID,
      customer_name: "Test",
      customer_email: "test@test.com",
      customer_phone: "600000000",
      starts_at: existingStart.toISOString(),
      ends_at: existingEnd.toISOString(),
      status: "confirmed",
      notes: null,
      created_at: "",
      updated_at: "",
    };

    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: baseService,
      businessHours: [MONDAY_HOURS],
      staffMembers: [baseStaff],
      existingAppointments: [existingAppt],
      staffTimeOffs: [],
    });

    // The 10:00 slot should be excluded
    const conflictingSlot = slots.find(
      (s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0,
    );
    expect(conflictingSlot).toBeUndefined();
  });

  it("excludes slots when staff is on time off", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: baseService,
      businessHours: [MONDAY_HOURS],
      staffMembers: [baseStaff],
      existingAppointments: [],
      staffTimeOffs: [
        {
          id: "off-1",
          staff_id: STAFF_ID,
          salon_id: SALON_ID,
          starts_at: `${TEST_DATE}T00:00:00Z`,
          ends_at: `${TEST_DATE}T23:59:59Z`,
          reason: "Vacaciones",
          created_at: "",
        },
      ],
    });

    expect(slots).toHaveLength(0);
  });

  it("respects buffer_after_minutes when calculating conflicts", () => {
    const serviceWithBuffer: Service = {
      ...baseService,
      duration_minutes: 45,
      buffer_after_minutes: 15,
    };

    // Existing appointment at 10:00 - 10:45
    const existingAppt: Appointment = {
      id: "appt-2",
      salon_id: SALON_ID,
      staff_id: STAFF_ID,
      service_id: SERVICE_ID,
      customer_name: "Test",
      customer_email: "test@test.com",
      customer_phone: "600000000",
      starts_at: `${TEST_DATE}T10:00:00`,
      ends_at: `${TEST_DATE}T10:45:00`,
      status: "confirmed",
      notes: null,
      created_at: "",
      updated_at: "",
    };

    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: serviceWithBuffer,
      businessHours: [MONDAY_HOURS],
      staffMembers: [baseStaff],
      existingAppointments: [existingAppt],
      staffTimeOffs: [],
    });

    // 10:00 slot should conflict (overlaps with existing)
    const slot1000 = slots.find(
      (s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0,
    );
    expect(slot1000).toBeUndefined();
  });

  it("returns slots at 15-minute intervals by default", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: { ...baseService, duration_minutes: 30 },
      businessHours: [MONDAY_HOURS],
      staffMembers: [baseStaff],
      existingAppointments: [],
      staffTimeOffs: [],
    });

    // Verify intervals are 15 minutes
    for (let i = 1; i < Math.min(slots.length, 5); i++) {
      const diff =
        slots[i].starts_at.getTime() - slots[i - 1].starts_at.getTime();
      expect(diff).toBe(15 * 60 * 1000);
    }
  });

  it("only considers pending and confirmed appointments for conflicts", () => {
    const cancelledAppt: Appointment = {
      id: "appt-3",
      salon_id: SALON_ID,
      staff_id: STAFF_ID,
      service_id: SERVICE_ID,
      customer_name: "Test",
      customer_email: "test@test.com",
      customer_phone: "600000000",
      starts_at: `${TEST_DATE}T10:00:00`,
      ends_at: `${TEST_DATE}T11:00:00`,
      status: "cancelled",
      notes: null,
      created_at: "",
      updated_at: "",
    };

    const slots = computeAvailableSlots({
      date: TEST_DATE,
      service: baseService,
      businessHours: [MONDAY_HOURS],
      staffMembers: [baseStaff],
      existingAppointments: [cancelledAppt],
      staffTimeOffs: [],
    });

    // Cancelled appointment should NOT block the 10:00 slot
    const slot1000 = slots.find(
      (s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0,
    );
    expect(slot1000).toBeDefined();
  });
});
