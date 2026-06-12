export type MarkdownTaskListItem = {
  checked: boolean;
  content: string;
};

const TASK_LIST_ITEM_PATTERN = /^\[([ xX])\]\s*(.*)$/;

export function parseMarkdownTaskListItem(item: string): MarkdownTaskListItem | null {
  const match = item.match(TASK_LIST_ITEM_PATTERN);

  if (!match) {
    return null;
  }

  return {
    checked: match[1].toLowerCase() === "x",
    content: match[2],
  };
}
