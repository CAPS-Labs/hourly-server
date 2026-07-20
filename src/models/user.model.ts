export interface User {
    id: number | string;
    fname: string;
    mname?: string;
    lname: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserDTO {
    fname: string;
    mname?: string;
    lname: string;
    email: string;
    password: string;
}

export interface UpdateUserDTO {
    email?: string;
    fname?: string;
    mname?: string;
    lname?: string;
    isActive?: boolean;
}