/* eslint-disable @typescript-eslint/no-explicit-any */

function opt(text: string, value: string) {
  return { text: { type: "plain_text" as const, text: text.slice(0, 75) }, value };
}

interface BuildArgs {
  userId: string;
  channelId: string | null;
  boards: { id: string; title: string }[];
  selectedBoardId?: string;
  lists?: { id: string; title: string }[];
  members?: { id: string; name: string }[];
  titleValue?: string;
  descValue?: string;
}

/**
 * Builds the "New Task" modal. Reused for views.open and views.update.
 * List + label selects are board-specific, so they're only added once a board is chosen.
 */
export function buildTaskModal({
  userId,
  channelId,
  boards,
  selectedBoardId,
  lists = [],
  members = [],
  titleValue,
  descValue,
}: BuildArgs) {
  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const blocks: any[] = [
    {
      type: "input",
      block_id: "title_block",
      element: {
        type: "plain_text_input",
        action_id: "title",
        placeholder: { type: "plain_text", text: "Task title" },
        ...(titleValue ? { initial_value: titleValue } : {}),
      },
      label: { type: "plain_text", text: "Task" },
    },
    {
      type: "input",
      block_id: "desc_block",
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: "desc",
        multiline: true,
        placeholder: { type: "plain_text", text: "Description (optional)" },
        ...(descValue ? { initial_value: descValue } : {}),
      },
      label: { type: "plain_text", text: "Description" },
    },
    {
      type: "input",
      block_id: "board_block",
      dispatch_action: true,
      element: {
        type: "static_select",
        action_id: "board",
        placeholder: { type: "plain_text", text: "Select a board" },
        options: boards.map((b) => opt(b.title, b.id)),
        ...(selectedBoard ? { initial_option: opt(selectedBoard.title, selectedBoard.id) } : {}),
      },
      label: { type: "plain_text", text: "Board" },
    },
  ];

  if (selectedBoardId) {
    if (lists.length) {
      blocks.push({
        type: "input",
        block_id: "list_block",
        element: {
          type: "static_select",
          action_id: "list",
          placeholder: { type: "plain_text", text: "Select a list" },
          options: lists.map((l) => opt(l.title, l.id)),
          initial_option: opt(lists[0].title, lists[0].id),
        },
        label: { type: "plain_text", text: "List" },
      });
    } else {
      blocks.push({
        type: "section",
        block_id: "no_list",
        text: { type: "mrkdwn", text: "_This board has no lists — pick another board._" },
      });
    }

    if (members.length) {
      blocks.push({
        type: "input",
        block_id: "assignees_block",
        optional: true,
        element: {
          type: "multi_static_select",
          action_id: "assignees",
          placeholder: { type: "plain_text", text: "Assign people (optional)" },
          options: members.map((m) => opt(m.name, m.id)),
        },
        label: { type: "plain_text", text: "Assignees" },
      });
    }
  } else {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "Lists and members load once you pick a board." }],
    });
  }

  return {
    type: "modal" as const,
    callback_id: "create_task",
    private_metadata: JSON.stringify({ userId, channelId }),
    title: { type: "plain_text", text: "New Task" },
    submit: { type: "plain_text", text: "Create" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}
