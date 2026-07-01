const chainMock = () => {
  const target = {
    data: [] as any[],
    error: null as any,
    select: (columns?: string) => target,
    order: (column: string, options?: { ascending?: boolean }) => target,
    limit: (count: number) => target
  };
  return target;
};

export const supabase = {
  from: (table: string) => chainMock()
};

export default supabase;
