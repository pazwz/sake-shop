const ORDER_NUMBER_PATTERN = /^LINXAS-\d{8}-[A-Z0-9]{6}$/;

export const getSafeOrderConfirmationNumber = (
  value: string | string[] | undefined,
) => {
  const orderNumber = Array.isArray(value) ? value[0] : value;
  return orderNumber && ORDER_NUMBER_PATTERN.test(orderNumber)
    ? orderNumber
    : null;
};
