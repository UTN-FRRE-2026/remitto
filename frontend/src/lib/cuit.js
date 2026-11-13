// 30712345671 → 30-71234567-1 (HU6).
export const formatearCuit = (cuit) => (cuit ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : '');
