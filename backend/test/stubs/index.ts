// Lightweight stand-ins for framework packages so unit tests can run the
// business logic without loading Nest/Prisma/bcrypt (ESM-only in this project).
const decorator = () => () => undefined;

export const Injectable = decorator;
export const Controller = decorator;
export const Get = decorator;
export const Post = decorator;
export const Patch = decorator;
export const Put = decorator;
export const Param = decorator;
export const Body = decorator;
export const Req = decorator;
export const UseGuards = decorator;
export const SetMetadata = decorator;

class HttpError extends Error {
  constructor(message?: any) {
    super(typeof message === 'string' ? message : JSON.stringify(message ?? ''));
  }
}
export class BadRequestException extends HttpError {}
export class ForbiddenException extends HttpError {}
export class UnauthorizedException extends HttpError {}

export class Reflector {}
export class JwtService {}
export class PrismaService {}

export const compare = async () => false;
export const hash = async () => 'hash';