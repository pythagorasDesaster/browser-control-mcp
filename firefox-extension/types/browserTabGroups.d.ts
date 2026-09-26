// See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/update
// This is a partial type representation of the browser.tabGroups API.

declare namespace browser.tabGroups {
  type Color =
    | "blue"
    | "cyan"
    | "grey"
    | "green"
    | "orange"
    | "pink"
    | "purple"
    | "red"
    | "yellow";

  interface TabGroup {
    id: number;
    title?: string;
    color: Color;
    collapsed: boolean;
    windowId: number;
  }

  interface GroupUpdateProperties {
    collapsed?: boolean;
    color?: Color;
    title?: string;
  }

  interface GroupQueryInfo {
    collapsed?: boolean;
    color?: Color;
    title?: string;
    windowId?: number;
  }

  interface GroupMoveProperties {
    index: number;
  }

  function update(
    groupId: number,
    updateProperties: GroupUpdateProperties
  ): Promise<TabGroup>;

  function query(queryInfo: GroupQueryInfo): Promise<TabGroup[]>;

  function move(
    groupId: number,
    moveProperties: GroupMoveProperties
  ): Promise<TabGroup>;
}

declare namespace browser.tabs {
  interface GroupOptions {
    tabIds: number[];
  }

  function group(options: GroupOptions): Promise<number>;
}
