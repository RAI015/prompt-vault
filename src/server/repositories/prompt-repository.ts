import type { Prisma, Prompt } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PromptInput } from "@/schemas/prompt";

const promptOrderBy: Prisma.PromptOrderByWithRelationInput[] = [
  {
    pinnedAt: {
      sort: "desc",
      nulls: "last",
    },
  },
  { updatedAt: "desc" },
];

export const listPromptsByOwner = async (ownerId: string): Promise<Prompt[]> => {
  return prisma.prompt.findMany({
    where: { ownerId },
    orderBy: promptOrderBy,
  });
};

export const findPromptByIdAndOwner = async (
  id: string,
  ownerId: string,
): Promise<Prompt | null> => {
  return prisma.prompt.findFirst({
    where: {
      id,
      ownerId,
    },
  });
};

export const createPrompt = async (ownerId: string, input: PromptInput): Promise<Prompt> => {
  return prisma.prompt.create({
    data: {
      ownerId,
      ...input,
    },
  });
};

export const updatePrompt = async (
  id: string,
  ownerId: string,
  input: PromptInput,
): Promise<Prompt> => {
  return prisma.prompt.update({
    where: { id },
    data: {
      ...input,
      ownerId,
    },
  });
};

export const deletePrompt = async (id: string): Promise<void> => {
  await prisma.prompt.delete({ where: { id } });
};

const MAX_PINNED_PROMPTS = 6;

export const setPromptPinState = async (
  ownerId: string,
  promptId: string,
  shouldPin: boolean,
): Promise<Prompt[]> => {
  return prisma.$transaction(async (tx) => {
    const target = await tx.prompt.findFirst({
      where: {
        id: promptId,
        ownerId,
      },
    });

    if (!target) {
      throw new Error("PROMPT_NOT_FOUND");
    }

    if (!shouldPin) {
      await tx.prompt.update({
        where: { id: promptId },
        data: { pinnedAt: null },
      });

      return tx.prompt.findMany({
        where: { ownerId },
        orderBy: promptOrderBy,
      });
    }

    const pinnedPrompts = await tx.prompt.findMany({
      where: {
        ownerId,
        pinnedAt: { not: null },
        NOT: { id: promptId },
      },
      orderBy: {
        pinnedAt: "asc",
      },
    });

    if (pinnedPrompts.length >= MAX_PINNED_PROMPTS) {
      const oldestPinnedPrompt = pinnedPrompts[0];
      if (oldestPinnedPrompt) {
        await tx.prompt.update({
          where: { id: oldestPinnedPrompt.id },
          data: { pinnedAt: null },
        });
      }
    }

    await tx.prompt.update({
      where: { id: promptId },
      data: { pinnedAt: new Date() },
    });

    return tx.prompt.findMany({
      where: { ownerId },
      orderBy: promptOrderBy,
    });
  });
};
