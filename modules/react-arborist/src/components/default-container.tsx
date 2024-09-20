import { FixedSizeList } from "react-window";
import { useDataUpdates, useTreeApi } from "../context";
import { ListOuterElement } from "./list-outer-element";
import { ListInnerElement } from "./list-inner-element";
import { RowContainer } from "./row-container";
import { TreeApi } from "../interfaces/tree-api";
import { useEffect, useRef } from "react";

let focusSearchTerm: string = "";
let timeoutId: NodeJS.Timeout | null = null;

const handleKeyDown = (tree: TreeApi<unknown>) => (e: any) => {
  const { onCreate, isWorkspaceTree } = tree.props;

  if (!onCreate) {
    console.warn("[handleKeyDown] [tree] Missing props!!!");
    return;
  }

  if (tree.isEditing) {
    return;
  }

  const focusWithinTree: boolean =
    tree.hasFocus || (document.activeElement && tree.listEl.current?.contains(document.activeElement)) ? true : false;

  // console.log("[Tree][handleKeyDown] ", { focusWithinTree, e });

  // ! GLOBAL TREE KEY-BINDS (NO FOCUSES REQUIRED)
  // ? Creating a new file or folder node.
  if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
    const isFolderCreate = e.shiftKey;
    const type = isFolderCreate ? (isWorkspaceTree ? "PROJECT" : "FOLDER") : isWorkspaceTree ? "PROJECT" : "FILE";

    let parentId: string | null = null;
    let parentNode = null;

    // @ts-ignore data is an unknown type.
    const haveFocusedFolder = tree.focusedNode?.data.type === "FOLDER";
    if (haveFocusedFolder) {
      parentId = tree.focusedNode.id;
      parentNode = tree.focusedNode;
    } else {
      // @ts-ignore data is an unknown type.
      const haveParentFolder = tree.focusedNode?.parent?.data.type === "FOLDER";
      if (haveParentFolder) {
        parentId = tree.focusedNode?.parent?.id as string;
        parentNode = tree.focusedNode?.parent;
      }
    }

    onCreate({
      index: 0,
      parentId,
      parentNode,
      type,
    });
    return;
  }

  // ? Toggle edit on focused node.
  if (e.key === "r" && e.metaKey) {
    const node = tree.focusedNode;
    if (!node) return;

    if (tree.selectedIds.size > 1) {
      tree.deselectAll();
      tree.focus(node);
    }

    if (!node.isEditable || !tree.props.onRename) return;
    setTimeout(() => {
      if (node) tree.edit(node);
    });

    return;
  }

  if (!focusWithinTree) {
    return;
  }

  // ! TREE FOCUS, BUT NO NODE FOCUS NEEDED KEY-BINDS
  // ? Focus on first or last node in the tree.
  if (e.key === "Home") {
    e.preventDefault();
    tree.focus(tree.firstNode);
    return;
  } else if (e.key === "End") {
    e.preventDefault();
    tree.focus(tree.lastNode);
    return;
  }
  const selectedIds = tree.selectedIds;
  const selectedNodes = tree.selectedNodes;
  const focusedNode = tree.focusedNode;

  // console.log("[Tree][handleKeyDown] ", { focusedNode, selectedIds, selectedNodes });

  if (!focusedNode) return;

  // ! TREE AND NODE FOCUS KEY-BINDS

  // ? Opening file, with focus swapping to it.
  if (e.key === "Enter" && !focusedNode.isEditing) {
    e.preventDefault();

    tree.setSelection({ ids: [focusedNode.id], anchor: focusedNode.id, mostRecent: focusedNode.id });
    tree.props.onEnter?.({ node: focusedNode });
    return;
  }

  // ? Copy/Paste selected node(s).
  if (e.key === "v" && e.metaKey) {
    const focusedNodeId = tree.focusedNode?.id;
    if (!focusedNodeId) return;
    tree?.props?.onPaste?.({ parentId: focusedNodeId });
    return;
  } else if (e.key === "c" && e.metaKey) {
    const copyNodesData = tree.selectedNodes.map((node) => node.data);
    if (copyNodesData.length === 0) return;
    tree?.props?.onCopy?.({ copyNodesData });
    return;
  }

  // ? Delete focused node(s).
  if (e.key === "Backspace" && e.metaKey) {
    const isFocusedNodeSelected = selectedIds.has(focusedNode.id);

    if (!isFocusedNodeSelected) {
      tree?.props?.onDelete?.({
        ids: new Set([focusedNode.id]),
        nodes: [focusedNode],
        nodeToFocusAfter: focusedNode?.prev || focusedNode?.next,
      });
    } else {
      tree?.props?.onDelete?.({
        ids: selectedIds,
        nodes: selectedNodes,
        nodeToFocusAfter: selectedNodes[0]?.prev || selectedNodes[selectedNodes.length - 1]?.next,
      });
    }

    return;
  }

  // ? Arrow Keys | Focusing on next or previous node.
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = tree.nextNode;
    if (e.metaKey) {
      tree.select(focusedNode);
      tree.activate(focusedNode);
      return;
    } else if (!e.shiftKey || tree.props.disableMultiSelection) {
      tree.focus(next);
      return;
    } else {
      if (!next) return;
      const current = focusedNode;
      if (!current) {
        tree.focus(tree.firstNode);
      } else if (current.isSelected) {
        tree.selectContiguous(next);
      } else {
        tree.selectMulti(next);
      }
      return;
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = tree.prevNode;
    if (!e.shiftKey || tree.props.disableMultiSelection) {
      tree.focus(prev);
      return;
    } else {
      if (!prev) return;
      const current = focusedNode;
      if (!current) {
        tree.focus(tree.lastNode); // ?
      } else if (current.isSelected) {
        tree.selectContiguous(prev);
      } else {
        tree.selectMulti(prev);
      }
      return;
    }
  }

  // ? Arrow Keys | Toggling open or close on focused node.
  if (e.key === "ArrowRight") {
    if (focusedNode.isInternal && focusedNode.isOpen) {
      tree.focus(tree.nextNode);
    } else if (focusedNode.isInternal) tree.open(focusedNode.id);
    return;
  }
  if (e.key === "ArrowLeft") {
    if (focusedNode.isRoot) return;
    if (focusedNode.isInternal && focusedNode.isOpen) tree.close(focusedNode.id);
    else if (!focusedNode.parent?.isRoot) {
      tree.focus(focusedNode.parent);
    }
    return;
  }

  // ? Selecting entire note tree.
  if (e.key === "a" && e.metaKey && !tree.props.disableMultiSelection) {
    e.preventDefault();
    tree.selectAll();
    return;
  }

  if (e.key === " ") {
    e.preventDefault();
    if (!focusedNode.isLeaf) {
      focusedNode.toggle();
    }
    return;
  }

  if (e.key === "*") {
    tree.openSiblings(focusedNode);
    return;
  }

  // If they type a sequence of characters
  // collect them. Reset them after a timeout.
  // Use it to search the tree for a node, then focus it.
  // Clean this up a bit later
  clearTimeout(timeoutId as NodeJS.Timeout);
  focusSearchTerm += e.key;
  timeoutId = setTimeout(() => {
    focusSearchTerm = "";
  }, 600);
  const node = tree.visibleNodes.find((n) => {
    // @ts-ignore
    const name = n.data.name;
    if (typeof name === "string") {
      return name.toLowerCase().startsWith(focusSearchTerm);
    } else return false;
  });
  if (node) tree.focus(node.id);

  return;
};

export function DefaultContainer() {
  useDataUpdates();

  const tree = useTreeApi();

  const handleOnFocus = (e: React.FocusEvent<HTMLDivElement, Element>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      tree.onFocus();
    }
  };

  const handleOnBlur = (e: React.FocusEvent<HTMLDivElement, Element>) => {
    // console.log("[blur] default container", { e, role: e?.target?.getAttribute("role") });
    const preventIds = ["node-settings-button", "node-plus-button", "create-popup-name"];

    const isNodeTreeItemNoRel = e?.target?.getAttribute("role") === "treeitem" && !e?.relatedTarget;
    if (isNodeTreeItemNoRel) {
      return;
    }

    if (
      !e.currentTarget.contains(e.relatedTarget) &&
      !preventIds.includes(e?.relatedTarget?.id as string) &&
      !preventIds.includes(e?.target?.id)
    ) {
      tree.onBlur();
    }
  };

  useEffect(() => {
    const handleKeyDownWithContext = handleKeyDown(tree);
    document.addEventListener("keydown", handleKeyDownWithContext);
    return () => {
      document.removeEventListener("keydown", handleKeyDownWithContext);
    };
  }, [tree]);

  useEffect(() => {
    tree.onFocus();
  }, []);

  return (
    <div
      role="tree"
      tabIndex={0}
      style={{
        height: tree.height,
        width: tree.width,
        minHeight: 0,
        minWidth: 0,
      }}
      onContextMenu={tree.props.onContextMenu}
      onClick={tree?.props?.onClick}
      onFocus={handleOnFocus}
      onBlur={handleOnBlur}
    >
      {/* @ts-ignore */}
      <FixedSizeList
        className={tree.props.className}
        outerRef={tree.listEl}
        itemCount={tree.visibleNodes.length}
        height={tree.height}
        width={tree.width}
        itemSize={tree.rowHeight}
        overscanCount={tree.overscanCount}
        itemKey={(index) => tree.visibleNodes[index]?.id || index}
        outerElementType={ListOuterElement}
        innerElementType={ListInnerElement}
        onScroll={tree.props.onScroll}
        onItemsRendered={tree.onItemsRendered.bind(tree)}
        ref={tree.list}
      >
        {RowContainer}
      </FixedSizeList>
    </div>
  );
}
