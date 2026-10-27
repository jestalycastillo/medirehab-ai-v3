-- Add the current catalog without replacing exercise IDs or patient history.
-- Existing descriptions, custom images and archived/active status are preserved.
-- A conflicting name/model mapping aborts this entire atomic statement.
DO $$
DECLARE
    item RECORD;
    exercise_id TEXT;
BEGIN
    LOCK TABLE "exercises", "exercise_images" IN SHARE ROW EXCLUSIVE MODE;

    FOR item IN
        SELECT * FROM (VALUES
            ('Shoulder Flexion', 'shoulder_flexion',
             'Stand upright with your arms at your sides. Select your target arm (left or right). Keeping your elbow straight, raise your arm forward and upward to shoulder height, then lower it slowly with control.',
             'Shoulder Flexion illustration', '/exercises/shoulder_flexion.png'),
            ('Shoulder Abduction', 'shoulder_abduction',
             'Stand upright with your arms at your sides. Select your target arm (left or right). Keeping your elbow straight, raise your arm outward to the side up to shoulder height, then lower it slowly with control.',
             'Shoulder Abduction', '/exercises/shoulder_abduction.png'),
            ('Side Arms Raise', 'side_arms_raise_v1',
             'Stand upright with both arms at your sides. Raise both arms outward together to shoulder height, then lower them slowly with control.',
             'Side Arms Raise', '/exercises/arms_raise.jpg'),
            ('Arm Circumduction', 'arm_circumduction',
             'Select the exercising arm. Perform the circular arm movement prescribed by your clinician, keeping both shoulders, elbows, and wrists in view.',
             'Arm Circumduction illustration', '/exercises/arm_circumduction.png'),
            ('Cross-body Shoulder Stretch', 'cross_body_shoulder_stretch',
             'Select the stretching arm. Follow your clinician’s prescribed cross-body stretch and hold duration, keeping the stretching and supporting arms visible.',
             'Cross-body Shoulder Stretch illustration', '/exercises/cross_body_shoulder_stretch.png'),
            ('External Rotation', 'external_rotation',
             'Follow your clinician’s prescribed outward forearm rotation and arm position. Keep both shoulders, elbows, and wrists visible throughout the recording.',
             'External Rotation illustration', '/exercises/external_rotation.png'),
            ('Internal Rotation', 'internal_rotation',
             'Follow your clinician’s prescribed inward forearm rotation and arm position. Keep both shoulders, elbows, and wrists visible throughout the recording.',
             'Internal Rotation illustration', '/exercises/internal_rotation.png')
        ) AS catalog(name, model_key, description, image_name, image_path)
    LOOP
        IF EXISTS (
            SELECT 1 FROM "exercises"
            WHERE ("name" = item.name AND "analysisModelKey" IS NOT NULL
                   AND "analysisModelKey" <> item.model_key)
               OR ("analysisModelKey" = item.model_key AND "name" <> item.name)
        ) THEN
            RAISE EXCEPTION 'Exercise catalog conflict for %. Existing records require manual review.', item.name;
        END IF;

        SELECT "id" INTO exercise_id FROM "exercises" WHERE "name" = item.name;

        IF exercise_id IS NULL THEN
            exercise_id := 'catalog_' || item.model_key;
            INSERT INTO "exercises" ("id", "name", "description", "analysisModelKey", "updatedAt")
            VALUES (exercise_id, item.name, item.description, item.model_key, CURRENT_TIMESTAMP);
        ELSE
            UPDATE "exercises"
            SET "analysisModelKey" = item.model_key, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = exercise_id AND "analysisModelKey" IS NULL;
        END IF;

        -- Only replace known obsolete catalog defaults, as the existing seed does.
        UPDATE "exercise_images"
        SET "imageName" = item.image_name, "filepath" = item.image_path,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "exerciseId" = exercise_id AND (
            (item.model_key = 'shoulder_flexion' AND "filepath" IN (
                '/exercises/shoulder_flexion.svg', '/exercises/left_flexion.jpg', '/exercises/right_flexion.jpg'
            )) OR
            (item.model_key = 'shoulder_abduction' AND "filepath" = '/exercises/arms_raise.jpg')
        );

        IF NOT EXISTS (SELECT 1 FROM "exercise_images" WHERE "exerciseId" = exercise_id) THEN
            INSERT INTO "exercise_images" ("id", "exerciseId", "imageName", "filepath", "updatedAt")
            VALUES ('catalog_image_' || item.model_key, exercise_id, item.image_name, item.image_path, CURRENT_TIMESTAMP);
        END IF;
    END LOOP;
END;
$$;
