import {
  afterPatch,
  fakeRenderComponent,
  findInReactTree,
  findModuleByExport,
  Export,
  MenuItem,
  Navigation,
  Patch,
  findInTree,
} from "@decky/ui";
import { FC } from "react";

const spliceTrailerItem = (children: any[], appid: number) => {
  if (!appid || isNaN(appid)) return;
  const propertiesMenuItemIdx = children.findIndex((item) =>
    findInReactTree(item, (x) => x?.onSelected && x.onSelected.toString().includes("AppProperties"))
  );
  const targetIdx = propertiesMenuItemIdx !== -1 ? propertiesMenuItemIdx : children.length;
  children.splice(
    targetIdx,
    0,
    <MenuItem
      key="decky-trailers-change-trailer"
      onSelected={() => {
        Navigation.Navigate(`/decky-trailers/${appid}`);
      }}
    >
      Change Trailer...
    </MenuItem>
  );
};

const isOpeningAppContextMenu = (items: any[]) => {
  if (!items?.length) return false;
  return !!findInReactTree(items, (x) => x?.props?.onSelected && x?.props?.onSelected.toString().includes("launchSource"));
};

const handleItemDupes = (items: any[]) => {
  const idx = items.findIndex((x: any) => x?.key === "decky-trailers-change-trailer");
  if (idx !== -1) items.splice(idx, 1);
};

const patchMenuItems = (menuItems: any[], appid: number) => {
  let updatedAppid: number = appid;
  const parentOverview = menuItems.find(
    (x: any) => x?._owner?.pendingProps?.overview?.appid && x._owner.pendingProps.overview.appid !== appid
  );
  if (parentOverview) {
    updatedAppid = parentOverview._owner.pendingProps.overview.appid;
  }
  if (updatedAppid === appid) {
    const foundApp = findInTree(menuItems, (x) => x?.app?.appid, { walkable: ["props", "children"] });
    if (foundApp) {
      updatedAppid = foundApp.app.appid;
    }
  }
  spliceTrailerItem(menuItems, updatedAppid);
};

export const contextMenuPatch = (LibraryContextMenu: any) => {
  if (!LibraryContextMenu?.prototype) return null;

  const patches: {
    outer?: Patch;
    inner?: Patch;
    unpatch: () => void;
  } = { unpatch: () => {} };

  patches.outer = afterPatch(LibraryContextMenu.prototype, "render", (_: Record<string, unknown>[], component: any) => {
    let appid: number = 0;
    if (component._owner) {
      appid = component._owner.pendingProps?.overview?.appid ?? 0;
    } else {
      const foundApp = findInTree(component.props?.children, (x) => x?.app?.appid, { walkable: ["props", "children"] });
      if (foundApp) {
        appid = foundApp.app.appid;
      }
    }

    if (!patches.inner) {
      patches.inner = afterPatch(component, "type", (_: any, ret: any) => {
        if (!ret?.type?.prototype) return ret;

        afterPatch(ret.type.prototype, "render", (_: any, ret2: any) => {
          const menuItems = ret2?.props?.children?.[0];
          if (!isOpeningAppContextMenu(menuItems)) return ret2;
          try {
            handleItemDupes(menuItems);
          } catch {
            return ret2;
          }
          patchMenuItems(menuItems, appid);
          return ret2;
        });

        afterPatch(ret.type.prototype, "shouldComponentUpdate", ([nextProps]: any, shouldUpdate: any) => {
          try {
            handleItemDupes(nextProps?.children);
          } catch {
            return shouldUpdate;
          }
          if (shouldUpdate === true) {
            patchMenuItems(nextProps.children, appid);
          }
          return shouldUpdate;
        });

        return ret;
      });
    } else if (component.props?.children) {
      spliceTrailerItem(component.props.children, appid);
    }
    return component;
  });

  patches.unpatch = () => {
    patches.outer?.unpatch();
    patches.inner?.unpatch();
  };

  return patches;
};

export const getLibraryContextMenu = (): any => {
  try {
    const module = findModuleByExport((e: Export) => e?.toString && e.toString().includes("().LibraryContextMenu"));
    if (!module) return undefined;
    const sibling = Object.values(module).find((s: any) => s?.toString?.().includes("navigator:"));
    if (!sibling) return undefined;
    return fakeRenderComponent(sibling as FC)?.type;
  } catch (err) {
    console.warn("[Decky Trailers] Could not find LibraryContextMenu", err);
    return undefined;
  }
};
