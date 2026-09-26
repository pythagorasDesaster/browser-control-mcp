export interface ExtensionMessageBase {
  resource: string;
  correlationId: string;
}

export interface TabContentExtensionMessage extends ExtensionMessageBase {
  resource: "tab-content";
  tabId: number;
  fullText: string;
  isTruncated: boolean;
  totalLength: number;
  links: { url: string; text: string }[];
}

export interface BrowserTab {
  id?: number;
  url?: string;
  title?: string;
  lastAccessed?: number;
  groupId?: number | null;
  windowId?: number;
}

export interface TabsExtensionMessage extends ExtensionMessageBase {
  resource: "tabs";
  tabs: BrowserTab[];
}

export interface TabGroupInfo {
  id: number;
  title?: string;
  color: string;
  collapsed: boolean;
  windowId: number;
  // Tab ids in this group, in tab-bar order
  tabIds: number[];
}

export interface TabGroupsExtensionMessage extends ExtensionMessageBase {
  resource: "tab-groups";
  tabGroups: TabGroupInfo[];
}

export interface OpenedTabIdExtensionMessage extends ExtensionMessageBase {
  resource: "opened-tab-id";
  tabId: number | undefined;
}

export interface BrowserHistoryItem {
  url?: string;
  title?: string;
  lastVisitTime?: number;
}

export interface BrowserHistoryExtensionMessage extends ExtensionMessageBase {
  resource: "history";

  historyItems: BrowserHistoryItem[];
}

export interface ReorderedTabsExtensionMessage extends ExtensionMessageBase {
  resource: "tabs-reordered";
  tabOrder: number[];
}

export interface FindHighlightExtensionMessage extends ExtensionMessageBase {
  resource: "find-highlight-result";
  noOfResults: number;
}

export interface TabsClosedExtensionMessage extends ExtensionMessageBase {
  resource: "tabs-closed";
}

export interface TabGroupCreatedExtensionMessage extends ExtensionMessageBase {
  resource: "new-tab-group";
  groupId: number;
}

export interface TabsAddedToGroupExtensionMessage extends ExtensionMessageBase {
  resource: "tabs-added-to-group";
  groupId: number;
  tabIds: number[];
}

export interface TabsUngroupedExtensionMessage extends ExtensionMessageBase {
  resource: "tabs-ungrouped";
}

export interface TabGroupUpdatedExtensionMessage extends ExtensionMessageBase {
  resource: "tab-group-updated";
  groupId: number;
  title?: string;
  color: string;
  collapsed: boolean;
}

export interface TabGroupMovedExtensionMessage extends ExtensionMessageBase {
  resource: "tab-group-moved";
  groupId: number;
  // The actual index of the group's first tab after the move (Firefox may clamp
  // the requested index), not the index that was requested.
  index: number;
  tabCount: number;
}

export interface ScreenshotExtensionMessage extends ExtensionMessageBase {
  resource: "screenshot";
  tabId: number;
  // Base64-encoded image, without the data-URL prefix
  imageData: string;
  mimeType: string;
}

export type ExtensionMessage =
  | TabContentExtensionMessage
  | TabsExtensionMessage
  | TabGroupsExtensionMessage
  | OpenedTabIdExtensionMessage
  | BrowserHistoryExtensionMessage
  | ReorderedTabsExtensionMessage
  | FindHighlightExtensionMessage
  | TabsClosedExtensionMessage
  | TabGroupCreatedExtensionMessage
  | TabsAddedToGroupExtensionMessage
  | TabsUngroupedExtensionMessage
  | TabGroupUpdatedExtensionMessage
  | TabGroupMovedExtensionMessage
  | ScreenshotExtensionMessage;

export interface ExtensionError {
  correlationId: string;
  errorMessage: string;
}