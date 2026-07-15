'use client';

import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Quiz, QuizOption, QuizQuestion, QuizQuestionType } from '@/lib/quiz';
import { cn } from '@/lib/utils';

/**
 * Контролируемый редактор теста урока для админки. Родитель держит модалку и
 * сохранение (как LessonContentEditor): передаёт value и получает Quiz через
 * onChange на каждое изменение. Валидация (min вопросов/вариантов, верный
 * ответ) — на стороне родителя/сервера через quizSchema из '@/lib/quiz'.
 */
interface QuizEditorProps {
  value: Quiz | null;
  onChange: (quiz: Quiz | null) => void;
  className?: string;
}

const emptyQuiz = (): Quiz => ({ passPercent: 70, questions: [] });
const emptyOption = (): QuizOption => ({ id: crypto.randomUUID(), text: '', correct: false });
const emptyQuestion = (): QuizQuestion => ({
  id: crypto.randomUUID(),
  text: '',
  type: 'single',
  options: [emptyOption(), emptyOption()],
});

export function QuizEditor({ value, onChange, className }: QuizEditorProps) {
  const [quiz, setQuiz] = useState<Quiz>(() => value ?? emptyQuiz());

  // Единая точка мутации: обновляет локальный стейт и пробрасывает наверх.
  function apply(next: Quiz) {
    setQuiz(next);
    onChange(next);
  }

  function setPassPercent(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const clamped = Number.isNaN(parsed) ? 1 : Math.min(100, Math.max(1, parsed));
    apply({ ...quiz, passPercent: clamped });
  }

  function updateQuestion(next: QuizQuestion) {
    apply({ ...quiz, questions: quiz.questions.map((q) => (q.id === next.id ? next : q)) });
  }

  function removeQuestion(qid: string) {
    apply({ ...quiz, questions: quiz.questions.filter((q) => q.id !== qid) });
  }

  function addQuestion() {
    apply({ ...quiz, questions: [...quiz.questions, emptyQuestion()] });
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="quiz-pass-percent" className="text-sm font-medium text-foreground">
          Порог прохождения, %
        </label>
        <Input
          id="quiz-pass-percent"
          type="number"
          min={1}
          max={100}
          value={quiz.passPercent}
          onChange={(e) => setPassPercent(e.target.value)}
          className="w-24"
        />
      </div>

      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            index={index}
            question={question}
            onChange={updateQuestion}
            onRemove={() => removeQuestion(question.id)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addQuestion}>
        <Plus className="size-4" aria-hidden />
        Добавить вопрос
      </Button>
    </div>
  );
}

function QuestionCard({
  index,
  question,
  onChange,
  onRemove,
}: {
  index: number;
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
  onRemove: () => void;
}) {
  function setText(text: string) {
    onChange({ ...question, text });
  }

  function setType(type: QuizQuestionType) {
    if (type === question.type) return;
    // При переходе в single оставляем верным только первый отмеченный вариант.
    if (type === 'single') {
      let kept = false;
      const options = question.options.map((o) => {
        if (o.correct && !kept) {
          kept = true;
          return o;
        }
        return o.correct ? { ...o, correct: false } : o;
      });
      onChange({ ...question, type, options });
      return;
    }
    onChange({ ...question, type });
  }

  function setOptionText(oid: string, text: string) {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === oid ? { ...o, text } : o)),
    });
  }

  function toggleCorrect(oid: string) {
    // single → радио (ровно один верный); multi → независимые чекбоксы.
    const options =
      question.type === 'single'
        ? question.options.map((o) => ({ ...o, correct: o.id === oid }))
        : question.options.map((o) => (o.id === oid ? { ...o, correct: !o.correct } : o));
    onChange({ ...question, options });
  }

  function addOption() {
    onChange({ ...question, options: [...question.options, emptyOption()] });
  }

  function removeOption(oid: string) {
    onChange({ ...question, options: question.options.filter((o) => o.id !== oid) });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2 shrink-0 text-sm font-medium text-muted-foreground">
          {index + 1}.
        </span>
        <Input
          value={question.text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст вопроса"
          aria-label={`Текст вопроса ${index + 1}`}
        />
        <IconButton label="Удалить вопрос" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden />
        </IconButton>
      </div>

      <div className="flex items-center gap-1 pl-6">
        <TypeTab active={question.type === 'single'} onClick={() => setType('single')}>
          Один ответ
        </TypeTab>
        <TypeTab active={question.type === 'multi'} onClick={() => setType('multi')}>
          Несколько
        </TypeTab>
      </div>

      <div className="space-y-2 pl-6">
        {question.options.map((option, oi) => (
          <div key={option.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(option.id)}
              aria-pressed={option.correct}
              aria-label={option.correct ? 'Верный вариант' : 'Отметить верным'}
              title="Отметить верным"
              className={cn(
                'inline-flex size-6 shrink-0 items-center justify-center border transition-colors',
                question.type === 'single' ? 'rounded-full' : 'rounded-md',
                option.correct
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-transparent hover:border-primary/60',
              )}
            >
              <Check className="size-4" aria-hidden />
            </button>
            <Input
              value={option.text}
              onChange={(e) => setOptionText(option.id, e.target.value)}
              placeholder={`Вариант ${oi + 1}`}
              aria-label={`Вариант ${oi + 1} вопроса ${index + 1}`}
            />
            <IconButton label="Удалить вариант" onClick={() => removeOption(option.id)}>
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addOption}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden />
          Вариант
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 text-muted-foreground hover:text-destructive"
    >
      {children}
    </Button>
  );
}

function TypeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
