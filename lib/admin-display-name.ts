export const getAdminDisplayName = (admin: {
  name: string;
  isActive: boolean;
}) =>
  !admin.isActive || /^KURA\b/i.test(admin.name) ? '旧管理者' : admin.name;
