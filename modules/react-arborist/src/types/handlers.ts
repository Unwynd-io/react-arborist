import { NodeApi } from "../interfaces/node-api";
import { IdObj } from "./utils";

export type CreateHandler<T> = (args: {
  parentId: string | null;
  parentNode: NodeApi<T> | null;
  index: number;
  type: "internal" | "leaf" | ("FILE" | "SUBFILE" | "FOLDER" | "PROJECT");
}) => (IdObj | null) | Promise<IdObj | null>;

export type MoveHandler<T> = (args: {
  dragIds: string[];
  dragNodes: NodeApi<T>[];
  parentId: string | null;
  parentNode: NodeApi<T> | null;
  index: number;
}) => void | Promise<void>;

export type RenameHandler<T> = (args: { id: string; name: string; node: NodeApi<T> }) => void | Promise<void>;

export type DeleteHandler<T> = (args: {
  ids: Set<string>;
  nodes: NodeApi<T>[];
  nodeToFocusAfter: NodeApi<T> | null;
}) => void | Promise<void>;

export type EditResult = { cancelled: true } | { cancelled: false; value: string };

export type CopyHandler<T> = (args: { copyNodesData: any }) => boolean;

export type PasteHandler<T> = (args: { parentId: string }) => boolean;

export type EnterHandler<T> = (args: { node: NodeApi<T> }) => void;
