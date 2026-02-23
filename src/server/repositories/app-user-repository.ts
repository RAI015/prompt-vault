import type { AppUser } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type UpsertAppUserInput = {
  authProvider: string;
  authSubject: string;
  email?: string | null;
};

export const upsertAppUser = async (input: UpsertAppUserInput): Promise<AppUser> => {
  return prisma.appUser.upsert({
    where: { authSubject: input.authSubject },
    create: {
      authProvider: input.authProvider,
      authSubject: input.authSubject,
      email: input.email,
    },
    update: {
      email: input.email,
    },
  });
};

export const findAppUserByAuthSubject = async (
  authSubject: string,
): Promise<AppUser | null> => {
  return prisma.appUser.findUnique({
    where: { authSubject },
  });
};
