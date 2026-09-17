// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewSession } from "./review-session";
import { studyFixture } from "@/test/review-cloud-fixture";
import type { StudyReviewEvent } from "@/services/study-items-service";

afterEach(cleanup);
const item = studyFixture();
const event: StudyReviewEvent = {
  id: "event",
  owner_id: item.owner_id,
  item_id: item.id,
  rating: "hard",
  reviewed_at: "2026-09-17T12:00:00.000Z",
  due_at_before: item.due_at,
  due_at_after: "2026-09-18T12:00:00.000Z",
  response_length: 2,
};
it("keeps the answer on failed save and advances once after a confirmed retry", async () => {
  let resolve!: (event: StudyReviewEvent) => void;
  const onRate = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline; retry"))
    .mockImplementationOnce(
      () =>
        new Promise<StudyReviewEvent>((done) => {
          resolve = done;
        }),
    );
  const view = render(<ReviewSession items={[item]} onRate={onRate} />);
  fireEvent.change(screen.getByLabelText("Student response"), { target: { value: "2x" } });
  fireEvent.click(screen.getByRole("button", { name: "Reveal / check" }));
  fireEvent.click(screen.getByRole("button", { name: "Hard" }));
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue("2x")).toBeTruthy();
  expect(screen.queryByTestId("review-session-summary")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hard" }));
  fireEvent.click(screen.getByRole("button", { name: "Hard" }));
  expect(onRate).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolve(event);
  });
  view.rerender(<ReviewSession items={[]} onRate={onRate} />);
  await waitFor(() => expect(screen.getByTestId("review-session-summary")).toBeTruthy());
  expect(screen.getByText("1 items")).toBeTruthy();
  expect(screen.getByText("Review the hard items again before adding more new material.")).toBeTruthy();
  expect(screen.queryByText("No due study items")).toBeNull();
});
