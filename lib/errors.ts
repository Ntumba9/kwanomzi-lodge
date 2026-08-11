export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomNotAvailableError extends DomainError {
  constructor(message = "Room is not available for the selected dates") {
    super("ROOM_NOT_AVAILABLE", message);
  }
}

export class RoomNotFoundError extends DomainError {
  constructor(message = "Room not found") {
    super("ROOM_NOT_FOUND", message);
  }
}

export class InvalidDateRangeError extends DomainError {
  constructor(message: string) {
    super("INVALID_DATE_RANGE", message);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super("INVALID_STATUS_TRANSITION", `Cannot transition booking from ${from} to ${to}`);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}

export class BookingNotFoundError extends DomainError {
  constructor(message = "Booking not found") {
    super("BOOKING_NOT_FOUND", message);
  }
}

export class PaymentNotAllowedError extends DomainError {
  constructor(message = "This booking cannot accept a payment right now") {
    super("PAYMENT_NOT_ALLOWED", message);
  }
}

/** YOCO_SECRET_KEY / RESEND_API_KEY / etc. missing — a deployment/config problem, not a user error. */
export class ServiceNotConfiguredError extends DomainError {
  constructor(message: string) {
    super("SERVICE_NOT_CONFIGURED", message);
  }
}
