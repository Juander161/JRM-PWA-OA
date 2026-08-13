import { buildFullPermissions, buildEmptyPermissions } from './permissionsSchema.js';

// Usuario semilla: mientras no exista pantalla de login, la app opera
// "como si" este usuario fuera el que inició sesión (ver PermissionsContext).
// Cuando se active el login real, currentUser dejará de ser fijo y este
// arreglo pasará a ser solo el respaldo local de usuarios/permisos.
export const defaultUsers = [
  {
    id: 'admin',
    nombre: 'Administrador',
    email: 'admin@oficina.local',
    rol: 'admin',
    activo: true,
    permisos: buildFullPermissions(),
  },
  {
    id: 'user-ejemplo',
    nombre: 'Usuario de ejemplo',
    email: 'usuario@oficina.local',
    rol: 'user',
    activo: true,
    permisos: buildEmptyPermissions(),
  },
];
