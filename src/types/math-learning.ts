export type CalculatorMode = "none" | "2d" | "3d";

export type MathDifficulty = "foundational" | "intermediate" | "advanced" | "applied";

export type MathVisibility = "draft" | "published" | "archived";

export type QuestionType =
  | "multiple_choice"
  | "multiple_select"
  | "true_false"
  | "short_answer"
  | "numeric"
  | "free_response"
  | "fill_blank"
  | "matching"
  | "step_ordering";

export type QuestionSourceType = "manual" | "imported" | "module_seed";

export type MathCourse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type MathTopic = {
  id: string;
  course_id: string;
  parent_topic_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type ModuleExpression = {
  id?: string;
  latex: string;
};

export type MathModuleJson = {
  overview?: string;
  sections?: Array<{
    title: string;
    body: string;
  }>;
  expressions?: ModuleExpression[];
  viewport?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  startingState?: DesmosState;
  learningGoals?: string[];
  graphNotes?: string;
};

export type MathModule = {
  id: string;
  course_id: string;
  topic_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  difficulty: MathDifficulty;
  calculator_mode: CalculatorMode;
  module_json: MathModuleJson;
  visibility: MathVisibility;
  created_at: string;
  updated_at: string;
};

export type MathGraphState = {
  id: string;
  user_id: string | null;
  module_id: string | null;
  note_id: string | null;
  question_id: string | null;
  calculator_mode: Exclude<CalculatorMode, "none">;
  title: string;
  desmos_state: DesmosState;
  expressions: ModuleExpression[] | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionChoice = {
  id: string;
  question_id: string;
  choice_text: string;
  choice_latex: string | null;
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type QuestionAnswerJson =
  | {
      correctChoiceId?: string;
      correctChoiceIds?: string[];
      expected?: number;
      tolerance?: number;
      units?: string | null;
      acceptedAnswers?: string[];
      caseSensitive?: boolean;
      normalizeWhitespace?: boolean;
      correctOrder?: string[];
      expectedBoolean?: boolean;
      completionPoints?: number;
      rubric?: string;
    }
  | Record<string, unknown>;

export type QuestionBankItem = {
  id: string;
  course_id: string | null;
  topic_id: string | null;
  module_id: string | null;
  note_id: string | null;
  graph_state_id: string | null;
  type: QuestionType;
  title: string | null;
  prompt_markdown: string;
  prompt_latex: string | null;
  answer_json: QuestionAnswerJson;
  explanation_markdown: string | null;
  explanation_latex: string | null;
  difficulty: MathDifficulty;
  calculator_allowed: boolean;
  estimated_time_seconds: number | null;
  source_type: QuestionSourceType;
  status: MathVisibility;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  choices?: QuestionChoice[];
  graph_state?: MathGraphState | null;
};

export type QuizSet = {
  id: string;
  user_id: string | null;
  course_id: string | null;
  topic_id: string | null;
  module_id: string | null;
  title: string;
  description: string | null;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  questions?: QuestionBankItem[];
};

export type QuizAttempt = {
  id: string;
  quiz_set_id: string;
  user_id: string | null;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  total_points: number | null;
  metadata_json: Record<string, unknown> | null;
};

export type QuestionAttempt = {
  id: string;
  quiz_attempt_id: string;
  question_id: string;
  user_id: string | null;
  submitted_answer_json: Record<string, unknown>;
  is_correct: boolean | null;
  points_awarded: number | null;
  feedback_json: Record<string, unknown> | null;
  created_at: string;
};

export type MathCourseBundle = {
  course: MathCourse;
  topics: MathTopic[];
  modules: MathModule[];
  questions: QuestionBankItem[];
};

export type MathModuleBundle = {
  course: MathCourse | null;
  topic: MathTopic | null;
  module: MathModule;
  questions: QuestionBankItem[];
  graphStates: MathGraphState[];
};
