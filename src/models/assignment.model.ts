export interface Assignment {
    assignedUser: number | string;
    projectAssignedTo: number | string;
    roleAssigned: string; //Should this be a foreign key connected to roles?
    createdAt: Date;
}

//Do I need an update DTO?