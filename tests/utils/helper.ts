export const padBytes = (data: string, length: number): number[] => {
  const bytes = Buffer.from(data);
  const padded = Buffer.alloc(length);
  bytes.copy(padded);
  return Array.from(padded);
};
