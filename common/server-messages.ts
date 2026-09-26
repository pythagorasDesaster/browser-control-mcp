export interface ServerMessageBase {
  cmd: string;
}

export interface OpenTabServerMessage extends ServerMessageBase {
  cmd: "open-tab";
  url: string;
}

export interface CloseTabsServerMessage extends ServerMessageBase {
  cmd: "close-tabs";
  tabIds: number[];
}

export interface GetTabListServerMessage extends ServerMessageBase {
  cmd: "get-tab-list";
}

export interface ListTabGroupsServerMessage extends ServerMessageBase {
  cmd: "list-tab-groups";
}

export interface GetBrowserRecentHistoryServerMessage extends ServerMessageBase {
  cmd: "get-browser-recent-history";
  searchQuery?: string;
}

export interface GetTabContentServerMessage extends ServerMessageBase {
  cmd: "get-tab-content";
  tabId: number;
  offset?: number;
}

export interface ReorderTabsServerMessage extends ServerMessageBase {
  cmd: "reorder-tabs";
  tabOrder: number[];
}

export interface FindHighlightServerMessage extends ServerMessageBase {
  cmd: "find-highlight";
  tabId: number;
  queryPhrase: string;
}

export interface GroupTabsServerMessage extends ServerMessageBase {
  cmd: "group-tabs";
  tabIds: number[];
  isCollapsed: boolean;
  groupColor: string;
  groupTitle: string;
}

export interface AddTabsToGroupServerMessage extends ServerMessageBase {
  cmd: "add-tabs-to-group";
  tabIds: number[];
  groupId: number;
}

export interface UngroupTabsServerMessage extends ServerMessageBase {
  cmd: "ungroup-tabs";
  tabIds: number[];
}

export interface UpdateTabGroupServerMessage extends ServerMessageBase {
  cmd: "update-tab-group";
  groupId: number;
  title?: string;
  color?: string;
  collapsed?: boolean;
}

export interface MoveTabGroupServerMessage extends ServerMessageBase {
  cmd: "move-tab-group";
  groupId: number;
  index: number;
}

export interface CaptureScreenshotServerMessage extends ServerMessageBase {
  cmd: "capture-screenshot";
  tabId: number;
  format?: "jpeg" | "png";
  quality?: number;
  scale?: number;
}

export type ServerMessage =
  | OpenTabServerMessage
  | CloseTabsServerMessage
  | GetTabListServerMessage
  | ListTabGroupsServerMessage
  | GetBrowserRecentHistoryServerMessage
  | GetTabContentServerMessage
  | ReorderTabsServerMessage
  | FindHighlightServerMessage
  | GroupTabsServerMessage
  | AddTabsToGroupServerMessage
  | UngroupTabsServerMessage
  | UpdateTabGroupServerMessage
  | MoveTabGroupServerMessage
  | CaptureScreenshotServerMessage;

export type ServerMessageRequest = ServerMessage & { correlationId: string };
