import { CreateUserDTO, UpdateUserDTO } from "#models/user.model.js";
import { pool } from "#config/db.config.js";

interface UserRow {
    id: number | string;
    fname: string;
    mname: string;
    lname: string;
    email: string;
    isActive: boolean;
    created_at: Date;
    updated_at: Date;
}

export class UserService {

    async createUser(dto: CreateUserDTO): Promise<Omit<UserRow, 'isActive'>> {
        //Check is user exists using email
        const checkEmailQuery = 'SELECT id FROM users WHERE email = $1';
        const existingUserRes = await pool.query(checkEmailQuery, [dto.email]);

        if (existingUserRes.rowCount && existingUserRes.rowCount > 0) {
            throw new Error('Email is already in use');
        }
    }

}