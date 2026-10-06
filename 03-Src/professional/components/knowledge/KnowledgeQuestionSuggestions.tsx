import { BookOpen, Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { shouldShowKnowledgeQuestionSuggestions } from "../agent-workspace/agentWorkspaceUtils";
import { isDemoKnowledgeQuestion } from "./knowledgeDemoQuestions";

const QUESTIONS_PER_PAGE = 6;

type Props = {
  value: string;
  questions: string[];
  onSelect: (question: string) => void;
  onSaveQuestions: (questions: string[]) => Promise<boolean>;
  defaultQuestions: string[];
  placement: "agent" | "dock";
};

export default function KnowledgeQuestionSuggestions({
  value,
  questions = [],
  onSelect,
  onSaveQuestions,
  defaultQuestions = [],
  placement,
}: Props) {
  const canShowSuggestions = shouldShowKnowledgeQuestionSuggestions(value);
  const [isDismissed, setIsDismissed] = useState(false);
  const [page, setPage] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [questionDrafts, setQuestionDrafts] = useState<string[]>(questions);
  const [savingQuestionIndex, setSavingQuestionIndex] = useState<number | null>(null);
  const [editorError, setEditorError] = useState("");
  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE));

  useEffect(() => {
    if (!canShowSuggestions) {
      setIsDismissed(false);
      setPage(0);
    }
  }, [canShowSuggestions]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages - 1));
  }, [totalPages]);

  function openEditor() {
    setQuestionDrafts([...questions]);
    setEditorError("");
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (savingQuestionIndex !== null) return;
    setEditorError("");
    setIsEditorOpen(false);
  }

  function updateQuestionDraft(index: number, value: string) {
    setQuestionDrafts((current) => current.map((question, questionIndex) => (
      questionIndex === index ? value : question
    )));
  }

  async function saveQuestion(index: number) {
    const question = String(questionDrafts[index] ?? "").replace(/\r/g, "").trim();
    if (!question) {
      setEditorError(`第 ${index + 1} 条常见问题不能为空。`);
      return;
    }
    if (questionDrafts.some((draft, questionIndex) => questionIndex !== index && draft.trim() === question)) {
      setEditorError(`第 ${index + 1} 条常见问题与其他条目重复。`);
      return;
    }
    const nextDrafts = questionDrafts.map((currentQuestion, questionIndex) => (
      questionIndex === index ? question : currentQuestion
    ));
    const nextQuestions = questions.map((currentQuestion, questionIndex) => (
      questionIndex === index ? question : currentQuestion
    ));
    setSavingQuestionIndex(index);
    setEditorError("");
    try {
      if (await onSaveQuestions(nextQuestions)) {
        setQuestionDrafts(nextDrafts);
      } else {
        setEditorError("保存失败，请确认后端服务正在运行。");
      }
    } finally {
      setSavingQuestionIndex(null);
    }
  }

  async function resetQuestion(index: number) {
    const defaultQuestion = defaultQuestions[index];
    if (!defaultQuestion) return;
    const nextQuestions = questions.map((question, questionIndex) => (
      questionIndex === index ? defaultQuestion : question
    ));
    const nextDrafts = questionDrafts.map((question, questionIndex) => (
      questionIndex === index ? defaultQuestion : question
    ));
    setSavingQuestionIndex(index);
    setEditorError("");
    try {
      if (await onSaveQuestions(nextQuestions)) {
        setQuestionDrafts(nextDrafts);
      } else {
        setEditorError("恢复项目默认失败，请确认后端服务正在运行。");
      }
    } finally {
      setSavingQuestionIndex(null);
    }
  }

  if (!canShowSuggestions || questions.length === 0 || isDismissed) return null;

  return (
    <section
      className={`knowledge-question-suggestions is-${placement}`}
      aria-label="常见知识库问题"
    >
      <header>
        <span aria-hidden="true"><BookOpen size={15} /></span>
        <div className="knowledge-question-suggestions__title">
          <strong>常见问题</strong>
          <small>{isEditorOpen ? "逐条编辑，右侧保存或恢复" : "点击填入，仍可继续修改"}</small>
        </div>
        <div className="knowledge-question-suggestions__controls" aria-label="常见问题翻页">
          <button
            className="knowledge-question-suggestions__page-button"
            type="button"
            aria-label="上一页常见问题"
            title="上一页"
            disabled={page === 0}
            onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="knowledge-question-suggestions__page-indicator" aria-live="polite">
            {page + 1}/{totalPages}
          </span>
          <button
            className="knowledge-question-suggestions__page-button"
            type="button"
            aria-label="下一页常见问题"
            title="下一页"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1))}
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <button
          className={`knowledge-question-suggestions__edit ${isEditorOpen ? "is-active" : ""}`}
          type="button"
          aria-label={isEditorOpen ? "退出编辑常见问题" : "编辑常见问题"}
          title={isEditorOpen ? "退出编辑" : "编辑常见问题"}
          onClick={isEditorOpen ? closeEditor : openEditor}
        >
          <Settings size={14} aria-hidden="true" />
        </button>
        <button
          className="knowledge-question-suggestions__close"
          type="button"
          aria-label="关闭常见问题"
          title="关闭"
          onClick={() => setIsDismissed(true)}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <div className={`knowledge-question-suggestions__list ${isEditorOpen ? "is-editing" : ""}`}>
        {editorError && isEditorOpen && <p className="knowledge-question-suggestions__editor-error" role="alert">{editorError}</p>}
        {questions
          .slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE)
          .map((question, index) => {
            const questionIndex = page * QUESTIONS_PER_PAGE + index;
            if (!isEditorOpen) {
              return (
                <button
                  key={`${question}-${questionIndex}`}
                  type="button"
                  onClick={() => onSelect(question)}
                >
                  <span>{questionIndex + 1}</span>
                  <strong>
                    {question}
                    {isDemoKnowledgeQuestion(question) && (
                      <i
                        className="knowledge-question-suggestions__demo-dot"
                        aria-label="标准演示问题"
                      />
                    )}
                  </strong>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              );
            }
            const isSaving = savingQuestionIndex === questionIndex;
            return (
              <div className="knowledge-question-suggestions__edit-row" key={`${question}-${questionIndex}`}>
                <span>{questionIndex + 1}</span>
                <textarea
                  rows={2}
                  value={questionDrafts[questionIndex] ?? question}
                  aria-label={`第 ${questionIndex + 1} 条常见问题`}
                  onChange={(event) => updateQuestionDraft(questionIndex, event.target.value)}
                  disabled={savingQuestionIndex !== null}
                />
                <div className="knowledge-question-suggestions__row-actions">
                  <button
                    className="is-primary"
                    type="button"
                    aria-label={`保存第 ${questionIndex + 1} 条常见问题`}
                    title="保存这一条"
                    disabled={savingQuestionIndex !== null}
                    onClick={() => void saveQuestion(questionIndex)}
                  >
                    {isSaving ? <Loader2 className="spin" size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    aria-label={`恢复第 ${questionIndex + 1} 条常见问题`}
                    title="恢复项目默认"
                    disabled={savingQuestionIndex !== null || !defaultQuestions[questionIndex]}
                    onClick={() => void resetQuestion(questionIndex)}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
