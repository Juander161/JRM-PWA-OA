import React, { createContext, useContext, useMemo, useState } from 'react';
import { defaultUsers } from '../data/defaultUsers.js';
import { buildEmptyPermissions } from '../data/permissionsSchema.js';
import { loadJSON, saveJSON } from '../services/storage/localStore.js';

const STORAGE_KEY = 'usuarios';

const PermissionsContext = createContext(null);

// NOTA: todavía no hay pantalla de login (decisión tomada mientras no exista
// backend/autenticación real). Por eso "currentUser" queda fijo como el admin
// semilla: así el resto de la app ya puede leer permisos por sección/acción
// sin bloquear a nadie. Cuando se agregue login real, solo hay que cambiar
// cómo se calcula currentUser aquí (por ejemplo, desde el resultado de auth)
// — los componentes que ya usan usePermission() no necesitan cambiar.
const CURRENT_USER_ID = 'admin';

export function PermissionsProvider({ children }) {
  const [users, setUsers] = useState(() => loadJSON(STORAGE_KEY, defaultUsers));

  function persist(nextUsers) {
    setUsers(nextUsers);
    saveJSON(STORAGE_KEY, nextUsers);
  }

  function addUser({ nombre, email, rol }) {
    const id = `user-${Date.now()}`;
    const nuevo = {
      id,
      nombre,
      email,
      rol: rol || 'user',
      activo: true,
      permisos: buildEmptyPermissions(),
    };
    persist([...users, nuevo]);
    return id;
  }

  function updateUser(id, patch) {
    persist(users.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  function removeUser(id) {
    persist(users.filter((u) => u.id !== id));
  }

  function setPermission(id, sectionKey, actionKey, value) {
    persist(
      users.map((u) =>
        u.id === id
          ? {
              ...u,
              permisos: {
                ...u.permisos,
                [sectionKey]: {
                  ...u.permisos[sectionKey],
                  [actionKey]: value,
                },
              },
            }
          : u
      )
    );
  }

  const currentUser = useMemo(
    () => users.find((u) => u.id === CURRENT_USER_ID) || users[0],
    [users]
  );

  const value = {
    users,
    currentUser,
    addUser,
    updateUser,
    removeUser,
    setPermission,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissionsContext debe usarse dentro de <PermissionsProvider>');
  }
  return ctx;
}

// Hook de conveniencia para que un componente pregunte "¿el usuario actual
// puede hacer esta acción en esta sección?". Hoy, al no haber login, el
// usuario actual es siempre el admin semilla (todo permitido), pero el
// resto de la app ya queda escrito contra este hook para cuando haya login.
export function usePermission(sectionKey, actionKey) {
  const { currentUser } = usePermissionsContext();
  if (!currentUser) return false;
  if (currentUser.rol === 'admin') return true;
  return Boolean(currentUser.permisos?.[sectionKey]?.[actionKey]);
}
