export interface RelationShipType {
  target?: string;
  type?: string;
}

export const RelTypes = {
  Comments: `http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments`,
  ThreadedComments: `http://schemas.microsoft.com/office/2017/10/relationships/threadedComment`
} as const;
export type RelTypes = typeof RelTypes[keyof typeof RelTypes];

export interface PeopleType {
  author: string;
}

export interface ConvertFromOptions {
  paramMap?: Map<string, any>;

  getRef?: (relId: string, refLocation: string, asBinary: boolean, parsedRefs: Map<string, Map<string, RelationShipType>>) => { location: string, data: any };

  getRefs?: (refLocation: string, parsedRefs: Map<string, Map<string, RelationShipType>>) => Map<string, RelationShipType>;

  parsedRefs?: Map<string, any>;

  onWarning?: (message: string) => void;

  addPerson?: (person: any) => string;
}