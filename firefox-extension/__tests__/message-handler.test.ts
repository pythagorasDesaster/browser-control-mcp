import { MessageHandler } from "../message-handler";
import { WebsocketClient } from "../client";
import type { ServerMessageRequest } from "@browser-control-mcp/common";
import { ExtensionConfig } from "../extension-config";
import { grantCaptureConsent, revokeCaptureConsent } from "../capture-consent";

// Mock the WebsocketClient
jest.mock("../client", () => {
  return {
    WebsocketClient: jest.fn().mockImplementation(() => {
      return {
        sendResourceToServer: jest.fn().mockResolvedValue(undefined),
        sendErrorToServer: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe("MessageHandler", () => {
  let messageHandler: MessageHandler;
  let mockClient: jest.Mocked<WebsocketClient>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new instance of WebsocketClient and MessageHandler
    mockClient = new WebsocketClient(
      8080,
      "test-secret"
    ) as jest.Mocked<WebsocketClient>;
    messageHandler = new MessageHandler(mockClient);

    // Mock browser.storage.local.get to return default config
    const defaultConfig: ExtensionConfig = {
      secret: "test-secret",
      toolSettings: {
        "open-browser-tab": true,
        "close-browser-tabs": true,
        "get-list-of-open-tabs": true,
        "get-recent-browser-history": true,
        "get-tab-web-content": true,
        "reorder-browser-tabs": true,
        "find-highlight-in-browser-tab": true,
        "list-tab-groups": true,
        "manage-tab-groups": true,
      },
      domainDenyList: [],
      ports: [8089],
      auditLog: [],
    };

    (browser.storage.local.get as jest.Mock).mockResolvedValue({
      config: defaultConfig,
    });
  });

  describe("handleDecodedMessage", () => {
    it("should throw an error if command is not allowed", async () => {
      // Arrange
      const configWithDisabledOpenTab: ExtensionConfig = {
        secret: "test-secret",
        toolSettings: {
          "open-browser-tab": false, // Disable open-tab command
          "close-browser-tabs": true,
          "get-list-of-open-tabs": true,
          "get-recent-browser-history": true,
          "get-tab-web-content": true,
          "reorder-browser-tabs": true,
          "find-highlight-in-browser-tab": true,
        },
        domainDenyList: [],
        ports: [8089],
        auditLog: [],
      };
      (browser.storage.local.get as jest.Mock).mockResolvedValue({
        config: configWithDisabledOpenTab,
      });

      const request: ServerMessageRequest = {
        cmd: "open-tab",
        url: "https://example.com",
        correlationId: "test-correlation-id",
      };

      // Act & Assert
      await expect(
        messageHandler.handleDecodedMessage(request)
      ).rejects.toThrow("Command 'open-tab' is disabled in extension settings");
    });

    describe("open-tab command", () => {
      it("should open a new tab and send the tab ID to the server", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "open-tab",
          url: "https://example.com",
          correlationId: "test-correlation-id",
        };

        const mockTab = { id: 123 };
        (browser.tabs.create as jest.Mock).mockResolvedValue(mockTab);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.create).toHaveBeenCalledWith({
          url: "https://example.com",
        });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "opened-tab-id",
          correlationId: "test-correlation-id",
          tabId: 123,
        });
      });

      it("should throw an error if URL does not start with https://", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "open-tab",
          url: "http://example.com",
          correlationId: "test-correlation-id",
        };

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow("Invalid URL");
        expect(browser.tabs.create).not.toHaveBeenCalled();
      });

      it("should throw an error if domain is in deny list", async () => {
        // Arrange
        const configWithDenyList: ExtensionConfig = {
          secret: "test-secret",
          toolSettings: {
            "open-browser-tab": true,
            "close-browser-tabs": true,
            "get-list-of-open-tabs": true,
            "get-recent-browser-history": true,
            "get-tab-web-content": true,
            "reorder-browser-tabs": true,
            "find-highlight-in-browser-tab": true,
          },
          domainDenyList: ["example.com", "another.com"],
          ports: [8089],
          auditLog: [],
        };
        (browser.storage.local.get as jest.Mock).mockResolvedValue({
          config: configWithDenyList,
        });

        const request: ServerMessageRequest = {
          cmd: "open-tab",
          url: "https://example.com",
          correlationId: "test-correlation-id",
        };

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow("Domain in user defined deny list");
        expect(browser.tabs.create).not.toHaveBeenCalled();
      });

      it("should open a new tab in the domain is not in the deny list", async () => {
        // Arrange
        const configWithDenyList: ExtensionConfig = {
          secret: "test-secret",
          toolSettings: {
            "open-browser-tab": true,
            "close-browser-tabs": true,
            "get-list-of-open-tabs": true,
            "get-recent-browser-history": true,
            "get-tab-web-content": true,
            "reorder-browser-tabs": true,
            "find-highlight-in-browser-tab": true,
          },
          domainDenyList: ["example.com", "another.com"],
          ports: [8089],
          auditLog: [],
        };
        (browser.storage.local.get as jest.Mock).mockResolvedValue({
          config: configWithDenyList,
        });

        const request: ServerMessageRequest = {
          cmd: "open-tab",
          url: "https://allowed.com",
          correlationId: "test-correlation-id",
        };

        const mockTab = { id: 123 };
        (browser.tabs.create as jest.Mock).mockResolvedValue(mockTab);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.create).toHaveBeenCalledWith({
          url: "https://allowed.com",
        });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "opened-tab-id",
          correlationId: "test-correlation-id",
          tabId: 123,
        });
      });
    });

    describe("close-tabs command", () => {
      it("should close tabs and send confirmation to the server", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "close-tabs",
          tabIds: [123, 456],
          correlationId: "test-correlation-id",
        };

        (browser.tabs.remove as jest.Mock).mockResolvedValue(undefined);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.remove).toHaveBeenCalledWith([123, 456]);
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tabs-closed",
          correlationId: "test-correlation-id",
        });
      });
    });

    describe("get-tab-list command", () => {
      it("should get tabs and send them to the server, normalizing groupId", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "get-tab-list",
          correlationId: "test-correlation-id",
        };

        const mockTabs = [
          { id: 123, url: "https://example.com", windowId: 1, groupId: 5 },
          { id: 456, url: "https://ungrouped.com", windowId: 1, groupId: -1 },
          { id: 789, url: "https://legacy.com", windowId: 1 },
        ];
        (browser.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.query).toHaveBeenCalledWith({});
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tabs",
          correlationId: "test-correlation-id",
          tabs: [
            { id: 123, url: "https://example.com", windowId: 1, groupId: 5 },
            { id: 456, url: "https://ungrouped.com", windowId: 1, groupId: null },
            { id: 789, url: "https://legacy.com", windowId: 1, groupId: null },
          ],
        });
      });
    });

    describe("list-tab-groups command", () => {
      const request: ServerMessageRequest = {
        cmd: "list-tab-groups",
        correlationId: "test-correlation-id",
      };

      it("should list tab groups with their tabs in tab-bar order", async () => {
        // Arrange
        const mockGroups = [
          { id: 1, title: "Work", color: "blue", collapsed: false, windowId: 10 },
          { id: 2, title: undefined, color: "grey", collapsed: true, windowId: 10 },
        ];
        const mockTabs = [
          { id: 30, index: 2, groupId: 1 },
          { id: 10, index: 0, groupId: 1 },
          { id: 20, index: 1, groupId: 1 },
          { id: 40, index: 3, groupId: 2 },
          { id: 50, index: 4, groupId: -1 },
        ];
        (browser.tabGroups.query as jest.Mock).mockResolvedValue(mockGroups);
        (browser.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabGroups.query).toHaveBeenCalledWith({});
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tab-groups",
          correlationId: "test-correlation-id",
          tabGroups: [
            {
              id: 1,
              title: "Work",
              color: "blue",
              collapsed: false,
              windowId: 10,
              tabIds: [10, 20, 30],
            },
            {
              id: 2,
              title: undefined,
              color: "grey",
              collapsed: true,
              windowId: 10,
              tabIds: [40],
            },
          ],
        });
      });

      it("should return an empty list when there are no tab groups", async () => {
        // Arrange
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([]);
        (browser.tabs.query as jest.Mock).mockResolvedValue([]);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tab-groups",
          correlationId: "test-correlation-id",
          tabGroups: [],
        });
      });

      it("should throw a clear error if the tabGroups API is unavailable", async () => {
        // Arrange
        const originalTabGroups = (browser as any).tabGroups;
        (browser as any).tabGroups = undefined;

        try {
          // Act & Assert
          await expect(
            messageHandler.handleDecodedMessage(request)
          ).rejects.toThrow(/requires Firefox 139 or later/);
          expect(browser.tabs.query).not.toHaveBeenCalled();
        } finally {
          (browser as any).tabGroups = originalTabGroups;
        }
      });
    });

    describe("get-browser-recent-history command", () => {
      it("should get history items and send them to the server", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "get-browser-recent-history",
          searchQuery: "test",
          correlationId: "test-correlation-id",
        };

        const mockHistoryItems = [
          { url: "https://example.com", title: "Example" },
          { url: "https://test.com", title: "Test" },
        ];
        (browser.history.search as jest.Mock).mockResolvedValue(
          mockHistoryItems
        );

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.history.search).toHaveBeenCalledWith({
          text: "test",
          maxResults: 200,
          startTime: 0,
        });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "history",
          correlationId: "test-correlation-id",
          historyItems: mockHistoryItems,
        });
      });

      it("should use empty string for search query if not provided", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "get-browser-recent-history",
          correlationId: "test-correlation-id",
        };

        const mockHistoryItems = [
          { url: "https://example.com", title: "Example" },
        ];
        (browser.history.search as jest.Mock).mockResolvedValue(
          mockHistoryItems
        );

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.history.search).toHaveBeenCalledWith({
          text: "",
          maxResults: 200,
          startTime: 0,
        });
      });

      it("should filter out history items without URLs", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "get-browser-recent-history",
          correlationId: "test-correlation-id",
        };

        const mockHistoryItems = [
          { url: "https://example.com", title: "Example" },
          { title: "No URL" }, // This should be filtered out
        ];
        (browser.history.search as jest.Mock).mockResolvedValue(
          mockHistoryItems
        );

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "history",
          correlationId: "test-correlation-id",
          historyItems: [{ url: "https://example.com", title: "Example" }],
        });
      });
    });

    describe("get-tab-content command", () => {
      it("should get tab content and send it to the server", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "get-tab-content",
          tabId: 123,
          correlationId: "test-correlation-id",
        };

        const mockTab = { id: 123, url: "https://example.com" };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
        (browser.permissions.contains as jest.Mock).mockResolvedValue(true);

        const mockScriptResult = [
          {
            links: [{ url: "https://example.com/page", text: "Page" }],
            fullText: "Page content",
            isTruncated: false,
            totalLength: 12,
          },
        ];
        (browser.tabs.executeScript as jest.Mock).mockResolvedValue(
          mockScriptResult
        );

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.get).toHaveBeenCalledWith(123);
        expect(browser.permissions.contains).toHaveBeenCalledWith({
          origins: ["https://example.com/*"],
        });
        expect(browser.tabs.executeScript).toHaveBeenCalled();
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tab-content",
          tabId: 123,
          correlationId: "test-correlation-id",
          isTruncated: false,
          fullText: "Page content",
          links: [{ url: "https://example.com/page", text: "Page" }],
          totalLength: 12,
        });
      });

      it("should throw an error if tab URL domain is in deny list", async () => {
        // Arrange
        const configWithDenyList: ExtensionConfig = {
          secret: "test-secret",
          toolSettings: {
            "open-browser-tab": true,
            "close-browser-tabs": true,
            "get-list-of-open-tabs": true,
            "get-recent-browser-history": true,
            "get-tab-web-content": true,
            "reorder-browser-tabs": true,
            "find-highlight-in-browser-tab": true,
          },
          domainDenyList: ["example.com"], // Add example.com to deny list
          ports: [8089],
          auditLog: [],
        };
        (browser.storage.local.get as jest.Mock).mockResolvedValue({
          config: configWithDenyList,
        });

        const request: ServerMessageRequest = {
          cmd: "get-tab-content",
          tabId: 123,
          correlationId: "test-correlation-id",
        };

        const mockTab = { id: 123, url: "https://example.com" };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow("Domain in tab URL is in the deny list");
        expect(browser.tabs.executeScript).not.toHaveBeenCalled();
      });

      it("should throw an error if permissions are denied", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "get-tab-content",
          tabId: 123,
          correlationId: "test-correlation-id",
        };

        const mockTab = { id: 123, url: "https://example.com" };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
        (browser.permissions.contains as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow();
        expect(browser.tabs.executeScript).not.toHaveBeenCalled();
      });
    });

    describe("reorder-tabs command", () => {
      it("should reorder tabs and send confirmation to the server", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "reorder-tabs",
          tabOrder: [123, 456, 789],
          correlationId: "test-correlation-id",
        };

        (browser.tabs.move as jest.Mock).mockResolvedValue(undefined);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.move).toHaveBeenCalledTimes(3);
        expect(browser.tabs.move).toHaveBeenNthCalledWith(1, 123, { index: 0 });
        expect(browser.tabs.move).toHaveBeenNthCalledWith(2, 456, { index: 1 });
        expect(browser.tabs.move).toHaveBeenNthCalledWith(3, 789, { index: 2 });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tabs-reordered",
          correlationId: "test-correlation-id",
          tabOrder: [123, 456, 789],
        });
      });
    });

    describe("find-highlight command", () => {
      it("should find and highlight text in a tab", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "find-highlight",
          tabId: 123,
          queryPhrase: "test",
          correlationId: "test-correlation-id",
        };

        const mockFindResults = { count: 5 };
        (browser.find.find as jest.Mock).mockResolvedValue(mockFindResults);
        (browser.tabs.update as jest.Mock).mockResolvedValue(undefined);
        (browser.permissions.contains as jest.Mock).mockResolvedValue(true);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.find.find).toHaveBeenCalledWith("test", {
          tabId: 123,
          caseSensitive: true,
        });
        expect(browser.tabs.update).toHaveBeenCalledWith(123, { active: true });
        expect(browser.find.highlightResults).toHaveBeenCalledWith({
          tabId: 123,
        });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "find-highlight-result",
          correlationId: "test-correlation-id",
          noOfResults: 5,
        });
      });

      it("should not highlight or activate tab if no results found", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "find-highlight",
          tabId: 123,
          queryPhrase: "test",
          correlationId: "test-correlation-id",
        };

        const mockFindResults = { count: 0 };
        const mockTab = { id: 123, url: "https://example.com" };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
        (browser.find.find as jest.Mock).mockResolvedValue(mockFindResults);
        (browser.permissions.contains as jest.Mock).mockResolvedValue(true);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.update).not.toHaveBeenCalled();
        expect(browser.find.highlightResults).not.toHaveBeenCalled();
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "find-highlight-result",
          correlationId: "test-correlation-id",
          noOfResults: 0,
        });
      });

      it("should throw an error if permissions are denied", async () => {
        // Arrange
        const request: ServerMessageRequest = {
          cmd: "find-highlight",
          tabId: 123,
          queryPhrase: "test",
          correlationId: "test-correlation-id",
        };

        const mockTab = { id: 123, url: "https://example.com" };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
        (browser.permissions.contains as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow();
        expect(browser.find.find).not.toHaveBeenCalled();
      });
    });

    describe("add-tabs-to-group command", () => {
      const request: ServerMessageRequest = {
        cmd: "add-tabs-to-group",
        tabIds: [10, 20],
        groupId: 1,
        correlationId: "test-correlation-id",
      };

      beforeEach(() => {
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([
          { id: 1, color: "blue", collapsed: false, windowId: 10 },
        ]);
        (browser.tabs.query as jest.Mock).mockResolvedValue([
          { id: 10 },
          { id: 20 },
        ]);
      });

      it("should add tabs to an existing group and confirm to the server", async () => {
        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.group).toHaveBeenCalledWith({
          tabIds: [10, 20],
          groupId: 1,
        });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tabs-added-to-group",
          correlationId: "test-correlation-id",
          groupId: 1,
          tabIds: [10, 20],
        });
      });

      it("should throw an error if the group does not exist", async () => {
        // Arrange
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([]);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/Tab group 1 does not exist/);
        expect(browser.tabs.group).not.toHaveBeenCalled();
      });

      it("should throw an error if a tab id does not exist", async () => {
        // Arrange
        (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 10 }]);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/Tab id\(s\) not found: 20/);
        expect(browser.tabs.group).not.toHaveBeenCalled();
      });
    });

    describe("ungroup-tabs command", () => {
      const request: ServerMessageRequest = {
        cmd: "ungroup-tabs",
        tabIds: [10, 20],
        correlationId: "test-correlation-id",
      };

      it("should ungroup tabs and confirm to the server", async () => {
        // Arrange
        (browser.tabs.query as jest.Mock).mockResolvedValue([
          { id: 10 },
          { id: 20 },
        ]);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.ungroup).toHaveBeenCalledWith([10, 20]);
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tabs-ungrouped",
          correlationId: "test-correlation-id",
        });
      });

      it("should throw an error if a tab id does not exist", async () => {
        // Arrange
        (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 10 }]);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/Tab id\(s\) not found: 20/);
        expect(browser.tabs.ungroup).not.toHaveBeenCalled();
      });
    });

    describe("update-tab-group command", () => {
      const request: ServerMessageRequest = {
        cmd: "update-tab-group",
        groupId: 1,
        title: "Work",
        collapsed: true,
        correlationId: "test-correlation-id",
      };

      it("should update the group and send the result to the server", async () => {
        // Arrange
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([
          { id: 1, color: "grey", collapsed: false, windowId: 10 },
        ]);
        (browser.tabGroups.update as jest.Mock).mockResolvedValue({
          id: 1,
          title: "Work",
          color: "grey",
          collapsed: true,
          windowId: 10,
        });

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabGroups.update).toHaveBeenCalledWith(1, {
          title: "Work",
          collapsed: true,
        });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tab-group-updated",
          correlationId: "test-correlation-id",
          groupId: 1,
          title: "Work",
          color: "grey",
          collapsed: true,
        });
      });

      it("should throw an error if the group does not exist", async () => {
        // Arrange
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([]);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/Tab group 1 does not exist/);
        expect(browser.tabGroups.update).not.toHaveBeenCalled();
      });
    });

    describe("move-tab-group command", () => {
      const request: ServerMessageRequest = {
        cmd: "move-tab-group",
        groupId: 1,
        index: 0,
        correlationId: "test-correlation-id",
      };

      it("should report the group's actual resulting index, not the requested one", async () => {
        // Arrange: Firefox clamped the requested index 0 to 170 in this scenario
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([
          { id: 1, color: "grey", collapsed: false, windowId: 10 },
        ]);
        (browser.tabGroups.move as jest.Mock).mockResolvedValue({
          id: 1,
          color: "grey",
          collapsed: false,
          windowId: 10,
        });
        (browser.tabs.query as jest.Mock).mockResolvedValue([
          { id: 100, index: 171, groupId: 1 },
          { id: 101, index: 170, groupId: 1 },
          { id: 102, index: 172, groupId: 1 },
          { id: 200, index: 5, groupId: 2 },
        ]);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabGroups.move).toHaveBeenCalledWith(1, { index: 0 });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tab-group-moved",
          correlationId: "test-correlation-id",
          groupId: 1,
          index: 170,
          tabCount: 3,
        });
      });

      it("should report the actual resulting index when moving to the end (index -1)", async () => {
        // Arrange
        const moveToEndRequest: ServerMessageRequest = {
          cmd: "move-tab-group",
          groupId: 1,
          index: -1,
          correlationId: "test-correlation-id",
        };
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([
          { id: 1, color: "grey", collapsed: false, windowId: 10 },
        ]);
        (browser.tabGroups.move as jest.Mock).mockResolvedValue({
          id: 1,
          color: "grey",
          collapsed: false,
          windowId: 10,
        });
        (browser.tabs.query as jest.Mock).mockResolvedValue([
          { id: 100, index: 8, groupId: 1 },
          { id: 101, index: 9, groupId: 1 },
        ]);

        // Act
        await messageHandler.handleDecodedMessage(moveToEndRequest);

        // Assert
        expect(browser.tabGroups.move).toHaveBeenCalledWith(1, { index: -1 });
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "tab-group-moved",
          correlationId: "test-correlation-id",
          groupId: 1,
          index: 8,
          tabCount: 2,
        });
      });

      it("should throw an error if the group does not exist", async () => {
        // Arrange
        (browser.tabGroups.query as jest.Mock).mockResolvedValue([]);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/Tab group 1 does not exist/);
        expect(browser.tabGroups.move).not.toHaveBeenCalled();
      });
    });

    describe("capture-screenshot command", () => {
      const request: ServerMessageRequest = {
        cmd: "capture-screenshot",
        tabId: 123,
        correlationId: "test-correlation-id",
      };

      beforeEach(() => {
        revokeCaptureConsent(123);
        (browser.tabs.captureVisibleTab as jest.Mock).mockResolvedValue(
          "data:image/jpeg;base64,QUJD"
        );
      });

      it("should refuse to capture a tab the user has not authorized", async () => {
        // Arrange
        const mockTab = {
          id: 123,
          url: "https://example.com",
          title: "Example",
          windowId: 1,
          active: true,
        };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/has not authorized screenshots of tab 123/);
        expect(browser.tabs.captureVisibleTab).not.toHaveBeenCalled();
        // The toolbar button is badged so the user can see which tab is waiting
        expect(browser.browserAction.setBadgeText).toHaveBeenCalledWith({
          text: "!",
          tabId: 123,
        });
      });

      it("should treat consent as revoked once the tab has navigated", async () => {
        // Arrange
        grantCaptureConsent(123, "https://example.com/first");
        const mockTab = {
          id: 123,
          url: "https://example.com/second",
          title: "Example",
          windowId: 1,
          active: true,
        };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow(/has not authorized screenshots of tab 123/);
        expect(browser.tabs.captureVisibleTab).not.toHaveBeenCalled();
      });

      it("should capture an authorized active tab and send the image to the server", async () => {
        // Arrange
        grantCaptureConsent(123, "https://example.com");
        const mockTab = {
          id: 123,
          url: "https://example.com",
          title: "Example",
          windowId: 1,
          active: true,
        };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
          format: "jpeg",
          quality: 70,
          scale: 1,
        });
        // An already-active tab must not be re-activated
        expect(browser.tabs.update).not.toHaveBeenCalled();
        expect(mockClient.sendResourceToServer).toHaveBeenCalledWith({
          resource: "screenshot",
          correlationId: "test-correlation-id",
          tabId: 123,
          imageData: "QUJD",
          mimeType: "image/jpeg",
        });
      });

      it("should foreground a background tab and restore the previous one", async () => {
        // Arrange
        grantCaptureConsent(123, "https://example.com");
        const mockTab = {
          id: 123,
          url: "https://example.com",
          title: "Example",
          windowId: 1,
          active: false,
        };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
        (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 456 }]);

        // Act
        await messageHandler.handleDecodedMessage(request);

        // Assert
        expect(browser.tabs.query).toHaveBeenCalledWith({
          active: true,
          windowId: 1,
        });
        expect(browser.tabs.update).toHaveBeenNthCalledWith(1, 123, {
          active: true,
        });
        expect(browser.tabs.update).toHaveBeenNthCalledWith(2, 456, {
          active: true,
        });
        expect(browser.tabs.captureVisibleTab).toHaveBeenCalled();
      });

      it("should throw an error if tab URL domain is in deny list", async () => {
        // Arrange
        grantCaptureConsent(123, "https://example.com");
        const configWithDenyList: ExtensionConfig = {
          secret: "test-secret",
          domainDenyList: ["example.com"],
          ports: [8089],
          auditLog: [],
        };
        (browser.storage.local.get as jest.Mock).mockResolvedValue({
          config: configWithDenyList,
        });

        const mockTab = {
          id: 123,
          url: "https://example.com",
          title: "Example",
          windowId: 1,
          active: true,
        };
        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow("Domain in tab URL is in the deny list");
        expect(browser.tabs.captureVisibleTab).not.toHaveBeenCalled();
      });

      it("should throw an error if the tool is disabled in settings", async () => {
        // Arrange
        grantCaptureConsent(123, "https://example.com");
        (browser.storage.local.get as jest.Mock).mockResolvedValue({
          config: {
            secret: "test-secret",
            toolSettings: { "capture-tab-screenshot": false },
            domainDenyList: [],
            ports: [8089],
            auditLog: [],
          } as ExtensionConfig,
        });

        // Act & Assert
        await expect(
          messageHandler.handleDecodedMessage(request)
        ).rejects.toThrow("Command 'capture-screenshot' is disabled");
        expect(browser.tabs.captureVisibleTab).not.toHaveBeenCalled();
      });
    });
  });
});
