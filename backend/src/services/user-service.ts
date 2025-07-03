import {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
    AdminUpdateUserAttributesCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  import { Logger } from '../utils/logger';
  
  export interface UserProfile {
    id: string;
    email: string;
    givenName?: string;
    familyName?: string;
    emailVerified: boolean;
    createdAt: string;
    lastModified: string;
  }
  
  export class UserService {
    private cognitoClient: CognitoIdentityProviderClient;
    private logger: Logger;
  
    constructor() {
      this.cognitoClient = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });
      
      this.logger = new Logger({ service: 'UserService' });
    }
  
    async getUserProfile(userId: string): Promise<UserProfile> {
      const logger = this.logger.withContext({ userId });
      
      try {
        const command = new AdminGetUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: userId,
        });
  
        const response = await this.cognitoClient.send(command);
  
        const getAttribute = (name: string) => {
          const attr = response.UserAttributes?.find(attr => attr.Name === name);
          return attr?.Value;
        };
  
        const profile: UserProfile = {
          id: userId,
          email: getAttribute('email') || '',
          givenName: getAttribute('given_name'),
          familyName: getAttribute('family_name'),
          emailVerified: getAttribute('email_verified') === 'true',
          createdAt: response.UserCreateDate?.toISOString() || '',
          lastModified: response.UserLastModifiedDate?.toISOString() || '',
        };
  
        logger.info('User profile retrieved');
        return profile;
      } catch (error) {
        logger.error('Failed to get user profile', error);
        throw error;
      }
    }
  
    async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
      const logger = this.logger.withContext({ userId });
      
      try {
        const userAttributes = [];
  
        if (updates.givenName !== undefined) {
          userAttributes.push({ Name: 'given_name', Value: updates.givenName });
        }
  
        if (updates.familyName !== undefined) {
          userAttributes.push({ Name: 'family_name', Value: updates.familyName });
        }
  
        if (userAttributes.length > 0) {
          const command = new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: userId,
            UserAttributes: userAttributes,
          });
  
          await this.cognitoClient.send(command);
        }
  
        logger.info('User profile updated');
        
        // Return updated profile
        return this.getUserProfile(userId);
      } catch (error) {
        logger.error('Failed to update user profile', error);
        throw error;
      }
    }
  }