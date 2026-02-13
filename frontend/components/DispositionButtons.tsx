"use client";

import { Button } from "@/components/ui/button";

type Props = {
  itemId: string;
  onNextAction?: () => void;
  onProject?: () => void;
  onWaiting?: () => void;
  onSomeday?: () => void;
  onReference?: () => void;
  onTrash?: () => void;
  onEditSuggestion?: () => void;
  onAskLater?: () => void;
  onAnswerQuestions?: () => void;
  showAskMe?: boolean;
  showAnswerQuestions?: boolean;
};

export function DispositionButtons({
  onNextAction,
  onProject,
  onWaiting,
  onSomeday,
  onReference,
  onTrash,
  onEditSuggestion,
  onAskLater,
  onAnswerQuestions,
  showAskMe,
  showAnswerQuestions,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {onNextAction && (
        <Button type="button" size="sm" onClick={onNextAction} className="bg-green-600 hover:bg-green-700 text-white">
          Make Next Action
        </Button>
      )}
      {onProject && (
        <Button type="button" size="sm" onClick={onProject} className="bg-blue-600 hover:bg-blue-700 text-white">
          Make Project
        </Button>
      )}
      {onWaiting && (
        <Button type="button" size="sm" variant="outline" onClick={onWaiting}>
          Waiting
        </Button>
      )}
      {onSomeday && (
        <Button type="button" size="sm" variant="outline" onClick={onSomeday}>
          Someday
        </Button>
      )}
      {onReference && (
        <Button type="button" size="sm" variant="outline" onClick={onReference}>
          Reference
        </Button>
      )}
      {onTrash && (
        <Button type="button" size="sm" variant="destructive" onClick={onTrash}>
          Trash
        </Button>
      )}
      {onEditSuggestion && (
        <Button type="button" size="sm" variant="outline" onClick={onEditSuggestion}>
          Edit suggestion
        </Button>
      )}
      {showAskMe && onAskLater && (
        <Button type="button" size="sm" variant="outline" onClick={onAskLater}>
          Ask me later
        </Button>
      )}
      {showAnswerQuestions && onAnswerQuestions && (
        <Button type="button" size="sm" onClick={onAnswerQuestions}>
          Answer questions
        </Button>
      )}
    </div>
  );
}
