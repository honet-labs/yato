import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export const ADMIN_ROLES = ["ADMIN", "SYSTEM ADMIN", "SYSTEM_ADMIN", "SUPERADMIN", "PRODUCTION"];

export function useIsAdmin(extraRoles: string[] = []) {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await api.get("/auth/profile");
      return res.data;
    },
  });

  const roles = profile?.roles?.map((ur: any) => ur.role?.name).filter(Boolean) || [];
  const permissions = profile?.roles?.flatMap((ur: any) => ur.role?.permissions || []) || [];

  const isAdmin = roles.some((role: string) =>
    [...ADMIN_ROLES, ...extraRoles].map(r => r.toUpperCase()).includes(role.toUpperCase())
  );

  return {
    isAdmin,
    isLoading,
    error,
    profile,
    roles,
    permissions,
  };
}
