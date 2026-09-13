const DEFAULT_RESERVATION_TTL_MINUTES = 30;

export const getReservationTtlMinutes = () => {
  const configured = Number(process.env.RESERVATION_TTL_MINUTES);
  return Number.isInteger(configured) && configured >= 15 && configured <= 120
    ? configured
    : DEFAULT_RESERVATION_TTL_MINUTES;
};

export const getReservationExpiry = (now = new Date()) =>
  new Date(now.getTime() + getReservationTtlMinutes() * 60_000);
