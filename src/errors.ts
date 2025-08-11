export class ParseError extends Error {
  constructor(message: string = 'Input is not valid lino format') {
    super(message);
    this.name = 'ParseError';
  }
}