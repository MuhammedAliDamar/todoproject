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
  titleValue?: string;
}

/**
 * Builds the "Yeni Görev" modal. Reused for views.open and views.update,
 * so the list select is only added once a board has been chosen.
 */
export function buildTaskModal({ userId, channelId, boards, selectedBoardId, lists = [], titleValue }: BuildArgs) {
  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const blocks: any[] = [
    {
      type: "input",
      block_id: "title_block",
      element: {
        type: "plain_text_input",
        action_id: "title",
        placeholder: { type: "plain_text", text: "Görev başlığı" },
        ...(titleValue ? { initial_value: titleValue } : {}),
      },
      label: { type: "plain_text", text: "Görev" },
    },
    {
      type: "input",
      block_id: "board_block",
      dispatch_action: true,
      element: {
        type: "static_select",
        action_id: "board",
        placeholder: { type: "plain_text", text: "Board seç" },
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
          placeholder: { type: "plain_text", text: "Liste seç" },
          options: lists.map((l) => opt(l.title, l.id)),
          initial_option: opt(lists[0].title, lists[0].id),
        },
        label: { type: "plain_text", text: "Liste" },
      });
    } else {
      blocks.push({
        type: "section",
        block_id: "no_list",
        text: { type: "mrkdwn", text: "_Bu board'da liste yok — başka board seçin._" },
      });
    }
  } else {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "Board seçince listeler yüklenir." }],
    });
  }

  return {
    type: "modal" as const,
    callback_id: "create_task",
    private_metadata: JSON.stringify({ userId, channelId }),
    title: { type: "plain_text", text: "Yeni Görev" },
    submit: { type: "plain_text", text: "Oluştur" },
    close: { type: "plain_text", text: "İptal" },
    blocks,
  };
}
