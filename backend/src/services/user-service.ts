import {
    AdminGetUserCommand,
    AdminUpdateUserAttributesCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  import { BaseService, ServiceContext } from './base-service';
  import { NotFoundError, CognitoServiceError } from '../utils/errors';
  
  export interface UserProfile {
    id: string;
    email: string;
    givenName?: string;
    familyName?: string;
    emailVerified: boolean;
    createdAt: string;
    lastModified: string;
  }
  
  export class UserService extends BaseService {
    constructor(context: ServiceContext = {}) {
      super('UserService', context);
      this.validateConfiguration();
    }
  
    async getUserProfile(userId: string): Promise<UserProfile> {
      return this.executeOperation(
        async () => {
          const command = new AdminGetUserCommand({
            UserPoolId: this.config.aws.cognito.userPoolId,
            Username: userId,
          });
    
          const response = await this.cognitoClient.send(command);
    
          if (!response.UserAttributes) {
            throw new NotFoundError('User');
          }
    
          const profile: UserProfile = {
            id: userId,
            email: this.extractUserAttribute(response.UserAttributes, 'email') || '',
            givenName: this.extractUserAttribute(response.UserAttributes, 'given_name'),
            familyName: this.extractUserAttribute(response.UserAttributes, 'family_name'),
            emailVerified: this.extractUserAttribute(response.UserAttributes, 'email_verified') === 'true',
            createdAt: response.UserCreateDate?.toISOString() || '',
            lastModified: response.UserLastModifiedDate?.toISOString() || '',
          };
    
          return profile;
        },
        'Get User Profile',
        { userId }
      );
    }
  
      async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.executeOperation(
      async () => {
        const attributesToUpdate: Record<string, string> = {};

        if (updates.givenName !== undefined) {
          attributesToUpdate.given_name = updates.givenName;
        }

        if (updates.familyName !== undefined) {
          attributesToUpdate.family_name = updates.familyName;
        }

        if (Object.keys(attributesToUpdate).length > 0) {
          const userAttributes = this.createUserAttributes(attributesToUpdate);
          
          const command = new AdminUpdateUserAttributesCommand({
            UserPoolId: this.config.aws.cognito.userPoolId,
            Username: userId,
            UserAttributes: userAttributes,
          });

          await this.cognitoClient.send(command);
        }

        // Return the updated profile
        return this.getUserProfile(userId);
      },
      'Update User Profile',
      { userId, updates }
    );
  }
  }