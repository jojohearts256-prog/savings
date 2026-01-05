export const formatUGX = (amount: unknown) =>
  `UGX ${Math.round(Number(amount ?? 0)).toLocaleString('en-UG')}`;
