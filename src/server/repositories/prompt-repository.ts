import type { Prompt } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PromptInput } from "@/schemas/prompt";

export const listPromptsByOwner = async (ownerId: string): Promise<Prompt[]> => {
  return prisma.prompt.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
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
