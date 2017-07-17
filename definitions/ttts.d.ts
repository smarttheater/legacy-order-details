declare namespace Express {
    export interface Request {
        staffUser?: StaffUser;
    }

    export class BaseUser {
        public isAuthenticated(): boolean;
        public get(key: string): any;
    }

    export class StaffUser extends BaseUser {
    }
}
